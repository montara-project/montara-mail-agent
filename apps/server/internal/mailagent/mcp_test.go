package mailagent

import (
	"strings"
	"testing"
)

// An MCP tool's name for the model keeps to the characters and length both
// providers accept, stays unique, and the chat summarizes it by server.
func TestMCPToolName(t *testing.T) {
	taken := map[string]mcpTool{}
	name := mcpToolName("exa", "web.search exa", taken)
	if name != "mcp__exa__web_search_exa" {
		t.Fatalf("mcpToolName = %q", name)
	}
	taken[name] = mcpTool{}
	if again := mcpToolName("exa", "web.search exa", taken); again != name+"_2" {
		t.Fatalf("a taken name gave %q", again)
	}
	long := mcpToolName("server", strings.Repeat("x", 100), map[string]mcpTool{})
	if len(long) > 64 || !strings.HasPrefix(long, "mcp__server__") {
		t.Fatalf("long name %q (%d)", long, len(long))
	}

	if summary, ok := mcpSummary("mcp__exa__web_search_exa"); !ok || summary != "ran web_search_exa on exa" {
		t.Fatalf("mcpSummary = %q, %v", summary, ok)
	}
	if _, ok := mcpSummary("search_mails"); ok {
		t.Fatal("a mailbox tool read as an MCP one")
	}
}
