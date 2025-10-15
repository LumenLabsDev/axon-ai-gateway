# Axon AI + Mistral
Axon AI helps bring Mistral's APIs to production with its observability suite & AI Gateway. Use the Mistral API **through** Axon AI for:
1. **Enhanced Logging**: Track API usage with detailed insights and custom segmentation.
2. **Production Reliability**: Automated fallbacks, load balancing, retries, time outs, and caching.
3. **Continuous Improvement**: Collect and apply user feedback.

### 1.1 Setup & Logging
1. Obtain your [**Axon AI API Key**](https://app.axon.ai/).
2. Set `$ export Axon AI_API_KEY=Axon AI_API_KEY`
3. Set `$ export MISTRAL_API_KEY=MISTRAL_API_KEY`
4. `pip install axon-ai` or `npm i axon-ai`

```py
""" OPENAI PYTHON SDK """
from axon_ai import Axon AI

axon = Axon AI(
    api_key="Axon AI_API_KEY",
    # ************************************
    provider="mistral-ai",
    Authorization="Bearer MISTRAL_API_KEY"
    # ************************************
)

response = axon.chat.completions.create(
    model="mistral-tiny",
    messages = [{ "role": "user", "content": "c'est la vie" }]
)
```

```javascript
import Axon AI from 'axon-ai';

const axon = new Axon AI({
    apiKey: "Axon AI_API_KEY",
    // ***********************************
    provider: "mistral-ai",
    Authorization: "Bearer MISTRAL_API_KEH"
    // ***********************************
})

async function main(){
  const response = await axon.chat.completions.create({
      model: "mistral-tiny",
      messages: [{ role: 'user', content: "c'est la vie" }]
  });
}

main()
```

### 1.2. Enhanced Observability
* **Trace** requests with single id.
* **Append custom tags** for request segmenting & in-depth analysis.

Just add their relevant headers to your request:

```py
from axon_ai import Axon AI

axon = Axon AI(
    api_key="Axon AI_API_KEY",
    provider="mistral-ai",
    Authorization="Bearer MISTRAL_API_KEY"
)

response = axon.with_options(
    # ************************************
    trace_id="ux5a7",
    metadata={"user": "john_doe"}
    # ************************************
).chat.completions.create(
    model="mistral-tiny",
    messages = [{ "role": "user", "content": "c'est la vie" }]
)
```

```javascript
import Axon AI from 'axon-ai';

const axon = new Axon AI({
    apiKey: "Axon AI_API_KEY",
    provider: "mistral-ai",
    Authorization: "Bearer MISTRAL_API_KEH"
})

async function main(){
  const response = await axon.chat.completions.create({
      model: "mistral-tiny",
      messages: [{ role: 'user', content: "c'est la vie" }]
  },{
    // ***********************************
    traceID: "ux5a7",
    metadata: {"user": "john_doe"}
});
}

main()
```

Here’s how your logs will appear on your Axon AI dashboard:

<img src="https://axon.ai/blog/content/images/2023/11/logsgif.gif" />

### 2. Caching, Fallbacks, Load Balancing
* **Fallbacks**: Ensure your application remains functional even if a primary service fails.
* **Load Balancing**: Efficiently distribute incoming requests among multiple models.
* **Semantic Caching**: Reduce costs and latency by intelligently caching results.

Toggle these features by saving _Configs_ (from the Axon AI dashboard > Configs tab).

If we want to enable semantic caching + fallback from Mistral-Medium to Mistral-Tiny, your Axon AI config would look like this:
```json
{
	"cache": {"mode": "semantic"},
	"strategy": {"mode": "fallback"},
	"targets": [
		{
			"provider": "mistral-ai", "api_key": "...",
			"override_params": {"model": "mistral-medium"}
		},
		{
			"provider": "mistral-ai", "api_key": "...",
			"override_params": {"model": "mistral-tiny"}
		}
	]
}
```

Now, just set the Config ID while instantiating Axon AI:

```py
""" OPENAI PYTHON SDK """
from axon_ai import Axon AI

axon = Axon AI(
    api_key="Axon AI_API_KEY",
    # ************************************
    config="pp-mistral-cache-xx"
    # ************************************
)

response = axon.chat.completions.create(
    model="mistral-tiny",
    messages = [{ "role": "user", "content": "c'est la vie" }]
)
```

```javascript
import Axon AI from 'axon-ai';

const axon = new Axon AI({
    apiKey: "Axon AI_API_KEY",
    // ***********************************
    config: "pp-mistral-cache-xx"
    // ***********************************
})

async function main(){
  const response = await axon.chat.completions.create({
      model: "mistral-tiny",
      messages: [{ role: 'user', content: "c'est la vie" }]
  });
}

main()
```

For more on Configs and other gateway feature like Load Balancing, [check out the docs.](https://axon.ai/docs/product/ai-gateway-streamline-llm-integrations)

### 3. Collect Feedback
Gather weighted feedback from users and improve your app:

```py
from axon import Axon AI

axon = Axon AI(
    api_key="Axon AI_API_KEY"
)

def send_feedback():
    axon.feedback.create(
        'trace_id'= 'REQUEST_TRACE_ID',
        'value'= 0  # For thumbs down
    )

send_feedback()
```

```javascript
import Axon AI from 'axon-ai';

const axon = new Axon AI({
    apiKey: "Axon AI_API_KEY"
});

const sendFeedback = async () => {
    await axon.feedback.create({
        traceID: "REQUEST_TRACE_ID",
        value: 1  // For thumbs up
    });
}
await sendFeedback();
```

#### Conclusion

Integrating Axon AI with Mistral helps you build resilient LLM apps from the get-go. With features like semantic caching, observability, load balancing, feedback, and fallbacks, you can ensure optimal performance and continuous improvement.

[Read full Axon AI docs here.](https://axon.ai/docs/) | [Reach out to the Axon AI team.](https://discord.gg/sDk9JaNfK8)
