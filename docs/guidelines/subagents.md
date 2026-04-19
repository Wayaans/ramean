# Subagent extensions inside ramean pi package

I want the to make super lightweight and easy to use subagent extension that can be easily integrated into any project. The subagent extension will provide a simple interface for creating and managing subagents, allowing developers to quickly set up and use subagents without needing to worry about the underlying implementation details.

Subagent always available to use for main agent with crystal clear instruction and guidelines on how to use it effectively, and also with clear rules and limitations for subagents to ensure that they are used in a way that is consistent with the overall goals and objectives of the project.

## Agents

- Agent : AG : Clear and unprompted agent that can be used for various tasks and purposes except UI/UX and front end development.
- Designer : DS : Prompted agent that can only be use for writing code about UI/UX or front end development.
- Reviewer : RV : Prompted agent that can be used for reviewing code, providing feedback, and suggesting improvements.

## Commands

- /agent -> command to show interactive UI for managing each subagents, including model selection and thinking mode selection
- /agent:prompt -> command to create append system_prompt or replace system_prompt for selected subagent and place it in project .pi/ramean/agents/ directory.
- /agent:spawn -> command to dispatch subagent directly without doing conversation to main agent with specific task user provide after command. Example /agent:spawn reviewer help me find dead code in this codebase. /agent:spawn designer revamp dashboard icon to use bigger icon.

## System Prompt

- Each subagent has default system prompt in markdown file under extensions/subagents/prompts/
- System prompt subagent can be append or replace when in project level directory inside .pi/ramean/agents/ has markdown file name with name of the subagent. Example .pi/ramean/agents/reviewer.md, .pi/ramean/agents/designer.md, and .pi/ramean/agents/agent.md. The content of the markdown file will be used as system prompt for the subagent, and it can be append to the default system prompt or replace the default system prompt.
- Subagent prompts is markdown file with front matter.

### Example prompts subagent

```markdown
---
name: agent/designer/reviewer
mode: append/replace
---

Hard rules:

- One
- Two
- Three
```

## Configuration

- Default to follow global config from this config extension.
- Config can be overwrite if in project level directory inside .pi/ramean/config.yaml
- if model that already set in global config not available, then inherit from main agent model with low thinking

```yaml
- extension: subagent
  enabled: true
  subagents:
    agent:
      - provider: github-copilot
      - model: gpt-5.4
      - thinking: medium
    designer:
      - provider: github-copilot
      - model: claude-sonnet-4.6
      - thinking: medium
    reviewer:
      - provider: github-copilot
      - model: gpt-5.4-mini
      - thinking: high
- null
```

## Tools

- manage
  - Description : Tools for managing subagents via dispatch tools, this is where to manage parallel, sequencing, and chain of subagents.
  - Label name : Manage
  - Short name : MG
  - Icon : ❏
  - Example usage :
    - Parallel: ❏ Parallel [➽ Agent -- ➽ Agent -- ➽ Designer]
    - Chain: ❏ Chain [➽ Agent -> ➽ Agent -> ➽ Designer]
    - Single: ❏ Single [➽ Agent]
- dispatch
  - Description : This is tools for dispatching subagents to do specific tasks or delegating work to subagents.
  - Label name : Dispatch
  - Short name : DP
  - Icon : ➽
  - Example usage : ➽ agent, ➽ designer, ➽ reviewer

## Rules

- Subagents not allowed to use manage and dispatch tools, they can only be used by the main agent or the user to manage and dispatch subagents.
- Subagents can use all tools, custom tools, skills, and commands except for manage and dispatch tools.
- Only subagent reviewer that only has tool for read only, including bash read only. Not allowed to write, edit, and bash write. Still can use custom tools as long is read only tools.

## UI

- manage: show in messages and widget pi, in messages only showing when the tools is being used, and in the widget above editor only show up when the tools is running managing subagents with live status icon.
- dispatch: only showing in messages when the tools is being used, and show the subagent that is being dispatched, has live status icon showing when running, waiting, failed, and success.

### Example UI for each tools

```manage tools in messages
❏ Parallel [➽ Agent = ➽ Agent = ➽ Designer]
```

```manage tools in messages
❏ Chain [➽ Agent ⟩ ➽ Agent ⟩ ➽ Designer]
```

```manage tools in messages
❏ Single [➽ Reviewer]
```

```manage tools in widget
⟩ MG:Parallel [⚏Agent ✔Agent ✖Designer ❖Reviewer]
```

❖ : waiting
⚏: running
✔ : success
✖ : failed

```dispatch tools in messages
⚏ Reviewer ⟩ Review current codebase and provide feedback for ...
└╍ Waiting streamline response...
```

```dispatch tools in messages
⚏ Reviewer ⟩ Review current codebase and provide feedback for ...
└╍ streamline response from subagent in here
```

```dispatch tools in messages expanded
✔ Reviewer ⟩ Review current codebase and provide feedback for ...
└╍ streamline response from subagent in here

❯ TASK :
The original task that is being dispatched to the subagent.

❯ OUTPUT :
the subagent’s final assistant response, rendered as Markdown

❯ WARNING/ERROR : only shown when the subagent encounter any warning or error during the process.
```
