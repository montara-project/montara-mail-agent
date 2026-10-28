package repositories

import "database/sql"

type Repositories struct {
	Organization OrganizationRepository
	User         UserRepository
	EmailAccount EmailAccountRepository
	Mail         MailRepository
	LLMProvider  LLMProviderRepository
	ActivityLog  ActivityLogRepository
	Agent        AgentRepository
	AgentBot     AgentBotRepository
	AgentSkill   AgentSkillRepository
	MCPServer    MCPServerRepository
}

// New builds every repository over db.
func New(db *sql.DB) Repositories {
	base := BaseRepository{DB: db}

	return Repositories{
		Organization: OrganizationRepository{base},
		User:         UserRepository{base},
		EmailAccount: EmailAccountRepository{base},
		Mail:         MailRepository{base},
		LLMProvider:  LLMProviderRepository{base},
		ActivityLog:  ActivityLogRepository{base},
		Agent:        AgentRepository{base},
		AgentBot:     AgentBotRepository{base},
		AgentSkill:   AgentSkillRepository{base},
		MCPServer:    MCPServerRepository{base},
	}
}
