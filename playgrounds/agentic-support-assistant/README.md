# Agentic Support Assistant Playground

This playground provides a local, tool-like support agent workflow:
- retrieve KB articles
- fetch ticket history
- produce action plans

## Beginner path

1. Run `npm install`
2. Run `npm run demo` to see ready-made examples
3. Run `npm run chat` and try your own prompts
4. Type `exit` to stop interactive mode

## Run interactive mode

```powershell
npm install
npm run chat
```

## Run scripted demo

```powershell
npm run demo
```

## What to learn

- How a simple assistant can combine ticket + KB context
- How deterministic "tool-like" behavior can be implemented without external services
- How to structure short action plans for support workflows
