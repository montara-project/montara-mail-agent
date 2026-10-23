// Package llm calls the model an organization configured, over either the
// OpenAI chat-completions or the Anthropic messages wire format.
package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// Provider kinds: the API format spoken, so any compatible server works
// (OpenAI, OpenRouter, Ollama, vLLM, ... or Anthropic and its proxies).
const (
	KindOpenAI    = "openai"
	KindAnthropic = "anthropic"
)

// Kinds lists the accepted provider kinds.
var Kinds = []string{KindOpenAI, KindAnthropic}

const defaultOpenAIBaseURL = "https://api.openai.com/v1"

// ErrRefused means the model declined to answer.
var ErrRefused = errors.New("the model declined to answer")

// Client completes one system + user prompt into text.
type Client interface {
	Complete(ctx context.Context, system, prompt string, maxTokens int64) (string, error)
}

// Config picks the provider. An empty BaseURL means the vendor's own API.
type Config struct {
	Kind    string
	BaseURL string
	APIKey  string
	Model   string
	// HTTPClient carries the guarded dialer (see lib.GuardedDialer).
	HTTPClient *http.Client
}

// New builds the client for cfg.Kind.
func New(cfg Config) (Client, error) {
	switch cfg.Kind {
	case KindAnthropic:
		opts := []option.RequestOption{option.WithAPIKey(cfg.APIKey), option.WithHTTPClient(cfg.HTTPClient)}
		if cfg.BaseURL != "" {
			opts = append(opts, option.WithBaseURL(cfg.BaseURL))
		}
		return anthropicClient{client: anthropic.NewClient(opts...), model: cfg.Model, native: cfg.BaseURL == ""}, nil
	case KindOpenAI:
		base := cfg.BaseURL
		if base == "" {
			base = defaultOpenAIBaseURL
		}
		return openAIClient{http: cfg.HTTPClient, baseURL: strings.TrimSuffix(base, "/"), apiKey: cfg.APIKey, model: cfg.Model}, nil
	}
	return nil, fmt.Errorf("unknown LLM provider kind %q", cfg.Kind)
}

type anthropicClient struct {
	client anthropic.Client
	model  string
	// native is true against Anthropic's own API, where low effort keeps
	// these short tasks fast and cheap; compatible servers may reject it.
	native bool
}

func (c anthropicClient) Complete(ctx context.Context, system, prompt string, maxTokens int64) (string, error) {
	params := anthropic.MessageNewParams{
		Model:     anthropic.Model(c.model),
		MaxTokens: maxTokens,
		System:    []anthropic.TextBlockParam{{Text: system}},
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(prompt))},
	}
	if c.native {
		params.OutputConfig = anthropic.OutputConfigParam{Effort: anthropic.OutputConfigEffortLow}
	}

	resp, err := c.client.Messages.New(ctx, params)
	if err != nil {
		return "", err
	}
	if resp.StopReason == anthropic.StopReasonRefusal {
		return "", ErrRefused
	}

	var text strings.Builder
	for _, block := range resp.Content {
		if b, ok := block.AsAny().(anthropic.TextBlock); ok {
			text.WriteString(b.Text)
		}
	}
	return strings.TrimSpace(text.String()), nil
}

type openAIClient struct {
	http    *http.Client
	baseURL string
	apiKey  string
	model   string
}

func (c openAIClient) Complete(ctx context.Context, system, prompt string, maxTokens int64) (string, error) {
	body, err := json.Marshal(map[string]any{
		"model": c.model,
		// max_tokens over max_completion_tokens: every compatible server
		// accepts it, the newer name is OpenAI-only.
		"max_tokens": maxTokens,
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": prompt},
		},
	})
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("chat completions: %s: %s", resp.Status, bytes.TrimSpace(snippet))
	}

	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&out); err != nil {
		return "", fmt.Errorf("chat completions: %w", err)
	}
	if len(out.Choices) == 0 {
		return "", errors.New("chat completions: no choices in the answer")
	}
	if out.Choices[0].FinishReason == "content_filter" {
		return "", ErrRefused
	}
	return strings.TrimSpace(out.Choices[0].Message.Content), nil
}
