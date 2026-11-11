IMPORTANT :

- ALWAYS USE CONTEXT7 BEFORE MAKE ANY CHANGE  
- ALWAYS USE SKILLS BEFORE MAKE ANY CHANGE  
- NEVER PUT SENSITIVE DATA ON THE FRONT END AND GITHUB  
- ALWAYS USE TASTE SKILLS FOR FRONT END  
- ALWAYS USE superpowers skills
- Always use the appropriate skills; for example, if you want to write code in Go, look for the relevant Go skills.
- Read relevant project notes before changing business
rules, requirements, or architecture.

For UI, copy, people, mobile layout, or code comments work, read \`antislop.md\` (core) and then the skill for the task:  

- UI / visual: \`skills/antislop-ui/SKILL.md\`  
- Copy &amp; text: \`skills/antislop-copywriting/SKILL.md\`  
- People: \`skills/antislop-human/SKILL.md\`  
- Mobile / responsive: \`skills/antislop-layoutmobile/SKILL.md\`  
- Code comments: \`skills/antislop-code/SKILL.md\`  
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say \`antislop active: &lt;mode&gt; (session override).\` or \`antislop active: &lt;mode&gt; (global preference).\` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.  
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.  
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.  
To update antislop later: download \`antislop.md\` again, or run \`npx antislop-ai --update\` if it was installed as skill folders.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- When graphify-out/graph.json exists, run `graphify query "[[ORCA_RICH_MD:3272a9f4a035003c7ac2aead79cd42ae:inline-html:%3Cquestion%3E]]"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "[[ORCA_RICH_MD:3272a9f4a035003c7ac2aead79cd42ae:inline-html:%3CA%3E]]" "[[ORCA_RICH_MD:3272a9f4a035003c7ac2aead79cd42ae:inline-html:%3CB%3E]]"` for relationships and `graphify explain "[[ORCA_RICH_MD:3272a9f4a035003c7ac2aead79cd42ae:inline-html:%3Cconcept%3E]]"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH\_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH\_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
- Consult graphify-out/GRAPH\_[REPORT.md](http://REPORT.md) for initial
  architecture orientation when it exists.

- Use Graphify queries to trace dependencies before  
  making changes across multiple modules.
-  Verify important conclusions against source files.
- Rebuild or update the graph after significant  
  structural code changes.

