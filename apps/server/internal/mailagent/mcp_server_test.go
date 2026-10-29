package mailagent

import (
	"slices"
	"testing"
)

// Over MCP a tool on one email keeps its schema, since the mail_id names the
// mailbox; every other tool gains a required account_id.
func TestMCPSchema(t *testing.T) {
	for _, def := range (&toolset{}).defs() {
		schema, byMail := mcpSchema(def.Parameters)
		if schema["type"] != "object" {
			t.Errorf("%s: type %v, want object", def.Name, schema["type"])
		}
		props := schema["properties"].(map[string]any)
		required, _ := schema["required"].([]any)
		_, hasMail := props["mail_id"]
		_, hasAccount := props["account_id"]
		switch {
		case hasMail != byMail:
			t.Errorf("%s: byMail %v, but mail_id present %v", def.Name, byMail, hasMail)
		case byMail && hasAccount:
			t.Errorf("%s: takes a mail_id and was given an account_id too", def.Name)
		case !byMail && (!hasAccount || !slices.Contains(required, any("account_id"))):
			t.Errorf("%s: account_id missing or not required: %v", def.Name, schema)
		}
	}
}
