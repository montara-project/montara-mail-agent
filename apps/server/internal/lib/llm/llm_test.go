package llm

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOpenAICompatible(t *testing.T) {
	finish := "stop"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" || r.Header.Get("Authorization") != "Bearer sk-test" {
			http.Error(w, "bad request "+r.URL.Path, http.StatusBadRequest)
			return
		}
		var body struct {
			Model    string `json:"model"`
			Messages []struct {
				Role, Content string
			} `json:"messages"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Model != "gpt-test" || len(body.Messages) != 2 || body.Messages[0].Role != "system" {
			http.Error(w, "bad body", http.StatusBadRequest)
			return
		}
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"  hello  "},"finish_reason":"` + finish + `"}]}`))
	}))
	defer server.Close()

	client, err := New(Config{Kind: KindOpenAI, BaseURL: server.URL + "/v1/", APIKey: "sk-test", Model: "gpt-test", HTTPClient: server.Client()})
	if err != nil {
		t.Fatal(err)
	}
	if got, err := client.Complete(context.Background(), "sys", "hi", 100); err != nil || got != "hello" {
		t.Fatalf("Complete = %q, %v", got, err)
	}

	finish = "content_filter"
	if _, err := client.Complete(context.Background(), "sys", "hi", 100); !errors.Is(err, ErrRefused) {
		t.Fatalf("filtered answer: %v, want ErrRefused", err)
	}

	bad, _ := New(Config{Kind: KindOpenAI, BaseURL: server.URL, APIKey: "wrong", Model: "gpt-test", HTTPClient: server.Client()})
	if _, err := bad.Complete(context.Background(), "sys", "hi", 100); err == nil {
		t.Fatal("an error status did not fail")
	}

	if _, err := New(Config{Kind: "gemini"}); err == nil {
		t.Fatal("an unknown kind was accepted")
	}
}

func TestListModels(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The Anthropic SDK decodes only a JSON content type.
		w.Header().Set("Content-Type", "application/json")
		switch {
		// OpenAI format: a self-hosted server without a key gets no header.
		case r.URL.Path == "/v1/models" && r.Header.Get("Authorization") == "":
			_, _ = w.Write([]byte(`{"object":"list","data":[{"id":"qwen3:8b"},{"id":"llama3.2"},{"id":"qwen3:8b"}]}`))
		// Anthropic format, with its own path and key header.
		case r.URL.Path == "/anthropic/v1/models" && r.Header.Get("X-Api-Key") == "sk-ant":
			_, _ = w.Write([]byte(`{"data":[{"id":"claude-b","type":"model","display_name":"B","created_at":"2026-01-01T00:00:00Z"},{"id":"claude-a","type":"model","display_name":"A","created_at":"2026-01-01T00:00:00Z"}],"has_more":false,"first_id":"claude-b","last_id":"claude-a"}`))
		default:
			http.Error(w, "bad request "+r.URL.Path, http.StatusUnauthorized)
		}
	}))
	defer server.Close()
	ctx := context.Background()

	got, err := ListModels(ctx, Config{Kind: KindSelfHosted, BaseURL: server.URL + "/v1", HTTPClient: server.Client()})
	if err != nil || len(got) != 2 || got[0] != "llama3.2" || got[1] != "qwen3:8b" {
		t.Fatalf("self-hosted models = %v, %v; want sorted and deduplicated", got, err)
	}
	got, err = ListModels(ctx, Config{Kind: KindAnthropic, BaseURL: server.URL + "/anthropic", APIKey: "sk-ant", HTTPClient: server.Client()})
	if err != nil || len(got) != 2 || got[0] != "claude-a" {
		t.Fatalf("anthropic models = %v, %v", got, err)
	}
	if _, err := ListModels(ctx, Config{Kind: KindOpenAI, BaseURL: server.URL + "/v1", APIKey: "wrong", HTTPClient: server.Client()}); err == nil {
		t.Fatal("a refused key did not fail")
	}
}

// Every request names Montara, whichever wire format and call carries it.
func TestClientHeaders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for name, want := range clientHeaders {
			if got := r.Header.Get(name); got != want {
				t.Errorf("%s %s: %s = %q, want %q", r.Method, r.URL.Path, name, got, want)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/messages":
			_, _ = w.Write([]byte(`{"content":[{"type":"text","text":"hi"}],"stop_reason":"end_turn"}`))
		case "/v1/models":
			_, _ = w.Write([]byte(`{"data":[{"id":"m"}]}`))
		default:
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"hi"},"finish_reason":"stop"}]}`))
		}
	}))
	defer server.Close()

	for _, cfg := range []Config{
		{Kind: KindOpenAI, BaseURL: server.URL + "/v1", APIKey: "k", Model: "m", HTTPClient: server.Client()},
		{Kind: KindAnthropic, BaseURL: server.URL, APIKey: "k", Model: "m", HTTPClient: server.Client()},
	} {
		client, err := New(cfg)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := client.Complete(context.Background(), "sys", "hi", 10); err != nil {
			t.Fatalf("%s Complete: %v", cfg.Kind, err)
		}
		if _, err := client.Chat(context.Background(), ChatRequest{System: "sys", Messages: []ChatMessage{{Role: RoleUser, Text: "hi"}}, MaxTokens: 10}); err != nil {
			t.Fatalf("%s Chat: %v", cfg.Kind, err)
		}
		if _, err := ListModels(context.Background(), cfg); err != nil {
			t.Fatalf("%s ListModels: %v", cfg.Kind, err)
		}
	}
}

// A server that leaves usage out is still metered, or the quota never runs out.
func TestUsageEstimatedWhenServerReportsNone(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"twelve chars"},"finish_reason":"stop"}]}`))
	}))
	defer server.Close()

	var got Usage
	client, err := New(Config{Kind: KindSelfHosted, BaseURL: server.URL, Model: "m", HTTPClient: server.Client(), OnUsage: func(_ string, u Usage) { got = u }})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := client.Complete(context.Background(), "system", "prompt", 16); err != nil {
		t.Fatal(err)
	}
	if got.Input <= 0 || got.Output != 3 {
		t.Fatalf("usage = %+v, want an input estimate and 3 output tokens", got)
	}

	if reported := (Usage{Input: 7, Output: 0}); usageOrEstimate(reported, 400, 400) != reported {
		t.Fatal("a reported usage must not be replaced by an estimate")
	}
}
