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
