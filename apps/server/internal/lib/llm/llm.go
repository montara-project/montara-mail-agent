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
	"slices"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// Provider kinds: the API format spoken, so any compatible server works
// (OpenAI, OpenRouter, ... or Anthropic and its proxies). Self-hosted is the
// OpenAI format on a server the user runs (Ollama, LM Studio, vLLM), where
// the base URL is required and the API key optional.
const (
	KindOpenAI     = "openai"
	KindAnthropic  = "anthropic"
	KindSelfHosted = "self_hosted"
)

// Kinds lists the accepted provider kinds.
var Kinds = []string{KindOpenAI, KindAnthropic, KindSelfHosted}

const defaultOpenAIBaseURL = "https://api.openai.com/v1"

// clientHeaders names Montara to the provider. No standard field exists:
// gateways read the User-Agent or OpenRouter's attribution headers, and a body
// field could be rejected by a strict server.
var clientHeaders = map[string]string{
	"User-Agent":         "montara-mail",
	"HTTP-Referer":       "https://app.montaramail.web.id",
	"X-Title":            "montara-mail",
	"X-OpenRouter-Title": "montara-mail",
}

func setClientHeaders(header http.Header) {
	for name, value := range clientHeaders {
		header.Set(name, value)
	}
}

func anthropicOptions(cfg Config) []option.RequestOption {
	opts := []option.RequestOption{option.WithAPIKey(cfg.APIKey), option.WithHTTPClient(cfg.HTTPClient)}
	if cfg.BaseURL != "" {
		opts = append(opts, option.WithBaseURL(cfg.BaseURL))
	}
	for name, value := range clientHeaders {
		opts = append(opts, option.WithHeader(name, value))
	}
	return opts
}

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
	// OnUsage reports every call's token usage ("chat" or "complete"); the
	// metering hook the token quota records through. May be nil.
	OnUsage func(purpose string, usage Usage)
	// HTTPClient carries the guarded dialer (see lib.GuardedDialer).
	HTTPClient *http.Client
}

// New builds the client for cfg.Kind. It carries both the one-shot Complete
// and the tool-calling Chat.
func New(cfg Config) (ChatClient, error) {
	switch cfg.Kind {
	case KindAnthropic:
		return anthropicClient{client: anthropic.NewClient(anthropicOptions(cfg)...), model: cfg.Model, native: cfg.BaseURL == "", onUsage: cfg.OnUsage}, nil
	case KindOpenAI, KindSelfHosted:
		return openAIClient{http: cfg.HTTPClient, baseURL: openAIBaseURL(cfg), apiKey: cfg.APIKey, model: cfg.Model, onUsage: cfg.OnUsage}, nil
	}
	return nil, fmt.Errorf("unknown LLM provider kind %q", cfg.Kind)
}

func openAIBaseURL(cfg Config) string {
	base := cfg.BaseURL
	if base == "" {
		base = defaultOpenAIBaseURL
	}
	return strings.TrimSuffix(base, "/")
}

// maxModels caps the list a server answers with; OpenRouter alone lists hundreds.
const maxModels = 1000

// ListModels returns the ids of the models cfg's server offers, sorted.
// cfg.Model is not used.
func ListModels(ctx context.Context, cfg Config) ([]string, error) {
	var ids []string
	switch cfg.Kind {
	case KindAnthropic:
		client := anthropic.NewClient(anthropicOptions(cfg)...)
		pages := client.Models.ListAutoPaging(ctx, anthropic.ModelListParams{Limit: anthropic.Int(maxModels)})
		for pages.Next() && len(ids) < maxModels {
			ids = append(ids, pages.Current().ID)
		}
		if err := pages.Err(); err != nil {
			return nil, err
		}
	case KindOpenAI, KindSelfHosted:
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, openAIBaseURL(cfg)+"/models", nil)
		if err != nil {
			return nil, err
		}
		setClientHeaders(req.Header)
		if cfg.APIKey != "" {
			req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
		}
		resp, err := cfg.HTTPClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
			return nil, fmt.Errorf("models: %s: %s", resp.Status, bytes.TrimSpace(snippet))
		}

		var out struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&out); err != nil {
			return nil, fmt.Errorf("models: %w", err)
		}
		for _, m := range out.Data {
			if m.ID != "" && len(ids) < maxModels {
				ids = append(ids, m.ID)
			}
		}
	default:
		return nil, fmt.Errorf("unknown LLM provider kind %q", cfg.Kind)
	}
	slices.Sort(ids)
	return slices.Compact(ids), nil
}

type anthropicClient struct {
	client anthropic.Client
	model  string
	// native is true against Anthropic's own API, where low effort keeps
	// these short tasks fast and cheap; compatible servers may reject it.
	native  bool
	onUsage func(purpose string, usage Usage)
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
	c.onUsageReport("complete", usageOrEstimate(
		Usage{Input: int(resp.Usage.InputTokens), Output: int(resp.Usage.OutputTokens)},
		len(system)+len(prompt), text.Len(),
	))
	return strings.TrimSpace(text.String()), nil
}

// usageOrEstimate returns what the server reported, or an estimate of about
// four characters a token when it reported nothing: some compatible and
// self-hosted servers leave usage out, and a call metered at zero would never
// spend the quota.
func usageOrEstimate(reported Usage, inputChars, outputChars int) Usage {
	if reported.Input > 0 || reported.Output > 0 {
		return reported
	}
	return Usage{Input: inputChars/4 + 1, Output: outputChars / 4}
}

// onUsageReport invokes the config's metering hook when one is set.
func (c anthropicClient) onUsageReport(purpose string, usage Usage) {
	if c.onUsage != nil {
		c.onUsage(purpose, usage)
	}
}

type openAIClient struct {
	http    *http.Client
	baseURL string
	apiKey  string
	model   string
	onUsage func(purpose string, usage Usage)
}

// onUsageReport invokes the config's metering hook when one is set.
func (c openAIClient) onUsageReport(purpose string, usage Usage) {
	if c.onUsage != nil {
		c.onUsage(purpose, usage)
	}
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
	setClientHeaders(req.Header)
	// A self-hosted server may run without a key.
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

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
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
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
	c.onUsageReport("complete", usageOrEstimate(
		Usage{Input: out.Usage.PromptTokens, Output: out.Usage.CompletionTokens},
		len(body), len(out.Choices[0].Message.Content),
	))
	return strings.TrimSpace(out.Choices[0].Message.Content), nil
}
