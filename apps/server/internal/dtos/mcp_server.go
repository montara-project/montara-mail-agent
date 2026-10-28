package dtos

import (
	"fmt"
	"regexp"
	"strings"

	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/validator"
)

// MCPPair is one header or environment variable. On an update an empty
// value keeps the one saved under the same name.
type MCPPair struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// MCPServerBody adds or changes an MCP server. Name is its slug, which also
// prefixes its tools' names for the model. A hosted or http server has a URL
// (http may add headers); a command server has a command, its arguments and
// environment.
type MCPServerBody struct {
	Name      string    `json:"name"`
	Kind      string    `json:"kind"`
	URL       string    `json:"url"`
	Headers   []MCPPair `json:"headers"`
	Command   string    `json:"command"`
	Args      []string  `json:"args"`
	Env       []MCPPair `json:"env"`
	IsEnabled *bool     `json:"is_enabled"`
}

func (dto MCPServerBody) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String().MaxLen(32).Regex(`^[a-z0-9][a-z0-9_-]*$`)
	v.Field("kind").Required().Regex(`^(hosted|http|command)$`)
	v.Field("url").String().MaxLen(2000)
	v.Field("command").String().MaxLen(500)
}

var (
	headerName = regexp.MustCompile(`^[A-Za-z0-9!#$%&'*+.^_|~-]{1,100}$`)
	envName    = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]{0,99}$`)
)

// Check validates what the field rules can't: the kind's required fields and
// the header and environment pairs.
func (dto MCPServerBody) Check() error {
	switch dto.Kind {
	case "hosted", "http":
		if !strings.HasPrefix(dto.URL, "https://") && !strings.HasPrefix(dto.URL, "http://") {
			return apperr.New(apperr.KindBadRequest, "url must be an http(s) URL")
		}
	case "command":
		if strings.TrimSpace(dto.Command) == "" {
			return apperr.New(apperr.KindBadRequest, "command is required")
		}
	}
	// An empty list is fine here, unlike validator.ArrayOf.
	if len(dto.Args) > 50 {
		return apperr.New(apperr.KindBadRequest, "at most 50 arguments")
	}
	for _, arg := range dto.Args {
		if len(arg) > 1000 || strings.ContainsRune(arg, 0) {
			return apperr.New(apperr.KindBadRequest, "an argument is too long or holds a NUL")
		}
	}
	if err := checkPairs("header", dto.Headers, headerName); err != nil {
		return err
	}
	return checkPairs("environment variable", dto.Env, envName)
}

func checkPairs(what string, pairs []MCPPair, name *regexp.Regexp) error {
	if len(pairs) > 20 {
		return apperr.New(apperr.KindBadRequest, "at most 20 of each %s", what)
	}
	seen := map[string]bool{}
	for _, p := range pairs {
		if !name.MatchString(p.Name) {
			return apperr.New(apperr.KindBadRequest, "%q isn't a valid %s name", p.Name, what)
		}
		key := strings.ToLower(p.Name)
		if seen[key] {
			return apperr.New(apperr.KindBadRequest, "the %s %s is set twice", what, p.Name)
		}
		seen[key] = true
		if len(p.Value) > 4000 || strings.ContainsAny(p.Value, "\r\n\x00") {
			return apperr.New(apperr.KindBadRequest, "%s",
				fmt.Sprintf("the %s %s has a value that is too long or spans lines", what, p.Name))
		}
	}
	return nil
}

// MCPServerTestBody tests a server before it is saved: the form's values,
// and, while editing, the saved server whose blank secret values to reuse.
type MCPServerTestBody struct {
	MCPServerBody
	ID string `json:"id"`
}

func (dto MCPServerTestBody) Validate(v *validator.MapValidator) {
	dto.MCPServerBody.Validate(v)
	v.Field("id").Regex(optionalUUID)
}
