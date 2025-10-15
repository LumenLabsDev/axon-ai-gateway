# Axon AI + Anyscale

Axon AI helps bring Anyscale APIs to production with its abstractions for observability, fallbacks, caching, and more. Use the Anyscale API **through** Axon AI for:

1. **Enhanced Logging**: Track API usage with detailed insights.
2. **Production Reliability**: Automated fallbacks, load balancing, and caching.
3. **Continuous Improvement**: Collect and apply user feedback.
4. **Enhanced Fine-Tuning**: Combine logs & user feedback for targetted fine-tuning.

### 1.1 Setup & Logging

1. Set `$ export OPENAI_API_KEY=ANYSCALE_API_KEY`
2. Obtain your [**Axon AI API Key**](https://app.axon.ai/).
3. Switch to **Axon AI Gateway URL:** `https://api.axon.ai/v1/proxy`

See full logs of requests (latency, cost, tokens)—and dig deeper into the data with their analytics suite.

```py
""" OPENAI PYTHON SDK """
import openai

Axon AI_GATEWAY_URL = "https://api.axon.ai/v1"

Axon AI_HEADERS = {
	'Authorization': 'Bearer ANYSCALE_KEY',
	'Content-Type': 'application/json',
	# **************************************
	'x-axon-api-key': 'Axon AI_API_KEY', 	# Get from https://app.axon.ai/,
	'x-axon-provider': 'anyscale' 		# Tell Axon AI that the request is for Anyscale
	# **************************************
}

client = openai.OpenAI(base_url=Axon AI_GATEWAY_URL, default_headers=Axon AI_HEADERS)

response = client.chat.completions.create(
    model="mistralai/Mistral-7B-Instruct-v0.1",
    messages=[{"role": "user", "content": "Say this is a test"}]
)

print(response.choices[0].message.content)
```

```javascript
""" OPENAI NODE SDK """
import OpenAI from 'openai';

const Axon AI_GATEWAY_URL = "https://api.axon.ai/v1"

const Axon AI_HEADERS = {
	'Authorization': 'Bearer ANYSCALE_KEY',
	'Content-Type': 'application/json',
	// **************************************
	'x-axon-api-key': 'Axon AI_API_KEY', 	// Get from https://app.axon.ai/,
	'x-axon-provider': 'anyscale' 		// Tell Axon AI that the request is for Anyscale
	// **************************************
}

const openai = new OpenAI({baseURL:Axon AI_GATEWAY_URL, defaultHeaders:Axon AI_HEADERS});

async function main() {
  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: 'Say this is a test' }],
    model: 'mistralai/Mistral-7B-Instruct-v0.1',
  });
  console.log(chatCompletion.choices[0].message.content);
}

main();
```

```py
""" REQUESTS LIBRARY """
import requests

Axon AI_GATEWAY_URL = "https://api.axon.ai/v1/chat/completions"

Axon AI_HEADERS = {
	'Authorization': 'Bearer ANYSCALE_KEY',
	'Content-Type': 'application/json',
	# **************************************
	'x-axon-api-key': 'Axon AI_API_KEY', 	# Get from https://app.axon.ai/,
	'x-axon-provider': 'anyscale' 		# Tell Axon AI that the request is for Anyscale
	# **************************************
}

DATA = {
    "messages": [{"role": "user", "content": "What happens when you mix red & yellow?"}],
    "model": "mistralai/Mistral-7B-Instruct-v0.1"
}

response = requests.post(Axon AI_GATEWAY_URL, headers=Axon AI_HEADERS, json=DATA)

print(response.text)
```

```bash
""" CURL """
curl "https://api.axon.ai/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ANYSCALE_KEY" \
  -H "x-axon-api-key: Axon AI_API_KEY" \
  -H "x-axon-provider: anyscale" \
  -d '{
    "model": "meta-llama/Llama-2-70b-chat-hf",
    "messages": [{"role": "user", "content": "Say 'Test'."}]
  }'
```

### 1.2. Enhanced Observability

- **Trace** requests with single id.
- **Append custom tags** for request segmenting & in-depth analysis.

Just add their relevant headers to your reuqest:

```py
""" OPENAI PYTHON SDK """
import json, openai

Axon AI_GATEWAY_URL = "https://api.axon.ai/v1"

TRACE_ID = 'anyscale_axon_test'

METADATA = {
    "_environment": "production",
    "_user": "userid123",
    "_organisation": "orgid123",
    "_prompt": "summarisationPrompt"
}

Axon AI_HEADERS = {
	'Authorization': 'Bearer ANYSCALE_KEY',
	'Content-Type': 'application/json',
	'x-axon-api-key': 'Axon AI_API_KEY',
	'x-axon-provider': 'anyscale',
	# **************************************
	'x-axon-trace-id': TRACE_ID, 		# Send the trace id
	'x-axon-metadata': json.dumps(METADATA) 	# Send the metadata
	# **************************************
}

client = openai.OpenAI(base_url=Axon AI_GATEWAY_URL, default_headers=Axon AI_HEADERS)

response = client.chat.completions.create(
	model="mistralai/Mistral-7B-Instruct-v0.1",
	messages=[{"role": "user", "content": "Say this is a test"}]
)

print(response.choices[0].message.content)
```

```javascript
""" OPENAI NODE SDK """
import OpenAI from 'openai';

const Axon AI_GATEWAY_URL = "https://api.axon.ai/v1"

const TRACE_ID = 'anyscale_axon_test'

const METADATA = {
    "_environment": "production",
    "_user": "userid123",
    "_organisation": "orgid123",
    "_prompt": "summarisationPrompt"
}

const Axon AI_HEADERS = {
	'Authorization': 'Bearer ANYSCALE_KEY',
	'Content-Type': 'application/json',
	'x-axon-api-key': 'Axon AI_API_KEY',
	'x-axon-provider': 'anyscale',
	// **************************************
	'x-axon-trace-id': TRACE_ID, 		// Send the trace id
	'x-axon-metadata': JSON.stringify(METADATA) 	// Send the metadata
	// **************************************
}

const openai = new OpenAI({baseURL:Axon AI_GATEWAY_URL, defaultHeaders:Axon AI_HEADERS});

async function main() {
  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: 'Say this is a test' }],
    model: 'mistralai/Mistral-7B-Instruct-v0.1',
  });
  console.log(chatCompletion.choices[0].message.content);
}

main();
```

```py
""" REQUESTS LIBRARY """
import requests, json

Axon AI_GATEWAY_URL = "https://api.axon.ai/v1/chat/completions"

TRACE_ID = 'anyscale_axon_test'

METADATA = {
    "_environment": "production",
    "_user": "userid123",
    "_organisation": "orgid123",
    "_prompt": "summarisationPrompt"
}

Axon AI_HEADERS = {
	'Authorization': 'Bearer ANYSCALE_KEY',
	'Content-Type': 'application/json',
	'x-axon-api-key': 'Axon AI_API_KEY',
	'x-axon-provider': 'anyscale',
	# **************************************
	'x-axon-trace-id': TRACE_ID, 		# Send the trace id
	'x-axon-metadata': json.dumps(METADATA) 	# Send the metadata
	# **************************************
}

DATA = {
    "messages": [{"role": "user", "content": "What happens when you mix red & yellow?"}],
    "model": "mistralai/Mistral-7B-Instruct-v0.1"
}

response = requests.post(Axon AI_GATEWAY_URL, headers=Axon AI_HEADERS, json=DATA)

print(response.text)
```

```bash
""" CURL """
curl "https://api.axon.ai/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ANYSCALE_KEY' \
  -H 'x-axon-api-key: Axon AI_KEY' \
  -H 'x-axon-provider: anyscale' \
  -H 'x-axon-trace-id: TRACE_ID' \
  -H 'x-axon-metadata: {"_environment": "production","_user": "userid123","_organisation": "orgid123","_prompt": "summarisationPrompt"}' \
  -d '{
    "model": "meta-llama/Llama-2-70b-chat-hf",
    "messages": [{"role": "user", "content": "Say 'Test'."}]
  }'
```

Here’s how your logs will appear on your Axon AI dashboard:

<img src="https://axon.ai/blog/content/images/2023/11/logsgif.gif" />

### 2. Caching, Fallbacks, Load Balancing

- **Fallbacks**: Ensure your application remains functional even if a primary service fails.
- **Load Balancing**: Efficiently distribute incoming requests among multiple models.
- **Semantic Caching**: Reduce costs and latency by intelligently caching results.

Toggle these features by saving _Configs_ (from the Axon AI dashboard > Configs tab).

If we want to enable semantic caching + fallback from Llama2 to Mistral, your Axon AI config would look like this:

```json
{
  "cache": { "mode": "semantic" },
  "strategy": { "mode": "fallback" },
  "targets": [
    {
      "provider": "anyscale",
      "api_key": "...",
      "override_params": { "model": "meta-llama/Llama-2-7b-chat-hf" }
    },
    {
      "provider": "anyscale",
      "api_key": "...",
      "override_params": { "model": "mistralai/Mistral-7B-Instruct-v0.1" }
    }
  ]
}
```

Now, just send the Config ID with `x-axon-config` header:

```py
""" OPENAI PYTHON SDK """
import openai, json

Axon AI_GATEWAY_URL = "https://api.axon.ai/v1"

Axon AI_HEADERS = {
	'Content-Type': 'application/json',
	'x-axon-api-key': 'Axon AI_API_KEY',
	# **************************************
	'x-axon-config': 'CONFIG_ID'
	# **************************************
}

client = openai.OpenAI(base_url=Axon AI_GATEWAY_URL, default_headers=Axon AI_HEADERS)

response = client.chat.completions.create(
	model="mistralai/Mistral-7B-Instruct-v0.1",
	messages=[{"role": "user", "content": "Say this is a test"}]
)

print(response.choices[0].message.content)
```

```javascript
""" OPENAI NODE SDK """
import OpenAI from 'openai';

const Axon AI_GATEWAY_URL = "https://api.axon.ai/v1"

const Axon AI_HEADERS = {
	'Content-Type': 'application/json',
	'x-axon-api-key': 'Axon AI_API_KEY',
	// **************************************
	'x-axon-config': 'CONFIG_ID'
	// **************************************
}

const openai = new OpenAI({baseURL:Axon AI_GATEWAY_URL, defaultHeaders:Axon AI_HEADERS});

async function main() {
  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: 'Say this is a test' }],
    model: 'mistralai/Mistral-7B-Instruct-v0.1',
  });
  console.log(chatCompletion.choices[0].message.content);
}

main();
```

```py
""" REQUESTS LIBRARY """
import requests, json

Axon AI_GATEWAY_URL = "https://api.axon.ai/v1/chat/completions"

Axon AI_HEADERS = {
	'Content-Type': 'application/json',
	'x-axon-api-key': 'Axon AI_API_KEY',
	# **************************************
	'x-axon-config': 'CONFIG_ID'
	# **************************************
}

DATA = {"messages": [{"role": "user", "content": "What happens when you mix red & yellow?"}]}

response = requests.post(Axon AI_GATEWAY_URL, headers=Axon AI_HEADERS, json=DATA)

print(response.text)
```

```bash
""" CURL """
curl "https://api.axon.ai/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "x-axon-api-key: Axon AI_API_KEY" \
  -H "x-axon-config: CONFIG_ID" \
  -d '{ "messages": [{"role": "user", "content": "Say 'Test'."}] }'
```

For more on Configs and other gateway feature like Load Balancing, [check out the docs.](https://axon.ai/docs/product/ai-gateway-streamline-llm-integrations)

### 3. Collect Feedback

Gather weighted feedback from users and improve your app:

```py
""" REQUESTS LIBRARY """
import requests
import json

Axon AI_FEEDBACK_URL = "https://api.axon.ai/v1/feedback" # Axon AI Feedback Endpoint

Axon AI_HEADERS = {
	"x-axon-api-key": "Axon AI_API_KEY",
	"Content-Type": "application/json",
}

DATA = {
	"trace_id": "anyscale_axon_test", # On Axon AI, you can append feedback to a particular Trace ID
	"value": 1,
	"weight": 0.5
}

response = requests.post(Axon AI_FEEDBACK_URL, headers=Axon AI_HEADERS, data=json.dumps(DATA))

print(response.text)
```

```bash
""" CURL """
curl "https://api.axon.ai/v1/feedback" \
  -H "x-axon-api-key: Axon AI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "trace_id": "anyscale_axon_test",
    "value": 1,
    "weight": 0.5
  }'
```

### 4. Continuous Fine-Tuning

Once you start logging your requests and their feedback with Axon AI, it becomes very easy to 1️) Curate & create data for fine-tuning, 2) Schedule fine-tuning jobs, and 3) Use the fine-tuned models!

Fine-tuning is currently enabled for select orgs - please request access on [Axon AI Discord](https://discord.gg/sDk9JaNfK8) and we'll get back to you ASAP.

<img src="https://axon.ai/blog/content/images/2023/11/fine-tune.gif" alt="header" width=600 />

#### Conclusion

Integrating Axon AI with Anyscale helps you build resilient LLM apps from the get-go. With features like semantic caching, observability, load balancing, feedback, and fallbacks, you can ensure optimal performance and continuous improvement.

[Read full Axon AI docs here.](https://axon.ai/docs/) | [Reach out to the Axon AI team.](https://discord.gg/sDk9JaNfK8)
