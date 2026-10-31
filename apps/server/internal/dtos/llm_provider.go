package dtos

import "montara-mail-agent/server/internal/lib/validator"

// LLMProviderBody sets the model of an organization, or the global one. The
// name is what the list shows; an empty base URL means the vendor's own API;
// an empty API key keeps the saved one while the kind and base URL stay the
// same.
type LLMProviderBody struct {
	Name    string `json:"name"`
	Kind    string `json:"kind"`
	BaseURL string `json:"base_url"`
	Model   string `json:"model"`
	APIKey  string `json:"api_key"`
}

func (dto LLMProviderBody) Validate(v *validator.MapValidator) {
	validateLLMProvider(v)
	v.Field("model").Required().String().MaxLen(200)
	v.Field("name").String().MaxLen(100)
}

// LLMProviderScopeBody moves a provider to an organization, to the
// platform-user scope when platform_user is set, or to global when both are
// empty.
type LLMProviderScopeBody struct {
	OrganizationID string `json:"organization_id"`
	PlatformUser   bool   `json:"platform_user"`
}

func (dto LLMProviderScopeBody) Validate(v *validator.MapValidator) {
	v.Field("organization_id").Regex(optionalUUID)
}

// LLMModelsBody is a provider, saved or not, whose models to list.
type LLMModelsBody struct {
	Kind    string `json:"kind"`
	BaseURL string `json:"base_url"`
	APIKey  string `json:"api_key"`
}

func (dto LLMModelsBody) Validate(v *validator.MapValidator) {
	validateLLMProvider(v)
}

func validateLLMProvider(v *validator.MapValidator) {
	v.Field("kind").Required().Regex(`^(openai|anthropic|self_hosted)$`)
	v.Field("base_url").String().MaxLen(500).Regex(`^(https?://[^\s]+)?$`)
	v.Field("api_key").String().MaxLen(1000)
}
