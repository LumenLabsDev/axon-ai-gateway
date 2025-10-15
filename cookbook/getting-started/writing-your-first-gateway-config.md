# 101 on Axon AI's Gateway Configs

You are likely familiar with how to make an API call to GPT4 for chat completions. However, did you know you can **set up** automatic retries for requests that might fail on OpenAI’s end using Axon AI?

The Axon AI AI gateway provides several useful features that you can use to enhance your requests. In this cookbook, we will start by making an API call to LLM and explore how Gateway Configs can be utilized to optimize these API calls.

## 1. API calls to LLMs with Axon AI

Consider a typical API call to GPT4 to get chat completions using OpenAI SDK. It takes `messages` and `model` arguments to get us a response. If you have tried one before, the following code snippet should look familiar. That’s because Axon AI Client SDK follows the same signature as OpenAI’s.

```js
import { Axon AI } from 'axon-ai';

const axon = new Axon AI({
  apiKey: 'xxxxxxxtrk',
  virtualKey: 'ma5xfxxxxx4x'
});

const messages = [
  {
    role: 'user',
    content: `What are the 7 wonders of the world?`
  }
];

const response = await axon.chat.completions.create({
  messages,
  model: 'gpt-4'
});

console.log(response.choices[0].message.content);
```

Along with Axon AI API Key ([get one](https://axon.ai/docs/api-reference/authentication#obtaining-your-api-key)), you might’ve noticed a new parameter while instantiating the `axon` variable — `virtualKey`. Axon AI securely stores API keys of LLM providers in a vault and substitutes them at runtime in your requests. These unique identifiers to your API keys are called Virtual Keys. For more information, see the [docs](https://axon.ai/docs/product/ai-gateway-streamline-llm-integrations/virtual-keys#creating-virtual-keys).

With basics out of our way, let’s jump into applying what we set out to do in the first place with the AI gateway — To automatically retry our request when we hit rate-limits (429 status codes).

## 2. Apply Gateway Configs

The AI gateway requires instructions to automatically retry requests. This involves providing Gateway Configs, which are essentially JSON objects that orchestrate the AI gateway. In our current scenario, we are targeting GPT4 with requests that have automatic retries on 429 status codes.

```json
{
  "retry": {
    "attempts": 3,
    "on_status_codes": [429]
  }
}
```

We now have our Gateway Configs sorted. But how do we instruct our AI gateway?

You guessed it, on the request headers. The next section will explore two ways to create and reference Gateway Configs.

### a. Reference Gateway Configs from the UI

Just as the title says — you create them on the UI and use an ID to have Axon AI automatically apply in the request headers to instruct the AI gateway. UI builder features lint suggestions, makes it easy to reference (through config ID), eliminates manual management, and allows you to view version history.

To create Gateway Configs,

1. Go to **axon.ai** and
2. Click on **Configs**
   1. Select **Create**
   2. Choose any name (such as request_retries)

Write the configs in the playground and click **Save Config**:

![Config Builder](../../docs/images/cookbooks/101-configs-1.png)

See the saved configs in the list along with the `ID`:

![Config ID](../../docs/images/cookbooks/101-configs-2.png)

Try it out now!

The Configs saved will appear as a row item on the Configs page. The `ID` is important as it is referenced in our calls through the AI gateway.

#### Axon AI SDK

The Axon AI SDK accepts the config parameter that takes the created config ID as it’s argument. To ensure all requests have automatic retries enabled on them, pass the config ID as argument when `axon` is instantiated.

That’s right! One line of code, and all the request from your apps now inherit Gateway Configs and demonstrate automatic retries.

Let’s take a look at the code snippet:

```js
import { Axon AI } from 'axon-ai';

const axon = new Axon AI({
  apiKey: 'xxxxxxrk',
  virtualKey: 'xxxxx',
  config: 'pc-xxxxx-edx21x' // Gateway Configs
});

const messages = [
  {
    role: 'user',
    content: `What are the 7 wonders of the world?`
  }
];

const response = await axon.chat.completions.create({
  messages,
  model: 'gpt-4'
});

console.log(response.choices[0].message.content);
```

#### Axios

In the cases, where you are not able to use an SDK, you can pass the same configs as headers with the key `x-axon-config` .

```js
const CONFIG_ID = 'pc-reques-edf21c';
const Axon AI_API_KEY = 'xxxxxrk';
const OPENAI_API_KEY = 'sk-*******';

const response = await axios({
  method: 'post',
  url: 'https://api.axon.ai/v1/chat/completions',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    'x-axon-api-key': Axon AI_API_KEY,
    'x-axon-provider': 'openai',
    'x-axon-config': CONFIG_ID
  },
  data: data
});

console.log(response.data);
```

#### OpenAI SDK

Axon AI can be used with OpenAI SDK.

To send a request with using OpenAI SDK client and apply gateway configs to the request pass a `baseURL` and necessary headers as follows:

```js
import OpenAI from 'openai'; // We're using the v4 SDK
import { Axon AI_GATEWAY_URL, createHeaders } from 'axon-ai';

const Axon AI_API_KEY = 'xxxxxrk';
const CONFIG_ID = 'pc-reques-edf21c';

const messages = [
  {
    role: 'user',
    content: `What are the 7 wonders of the world?`
  }
];

const openai = new OpenAI({
  apiKey: 'OPENAI_API_KEY', // When you pass the parameter `virtualKey`, this value is ignored.
  baseURL: Axon AI_GATEWAY_URL,
  defaultHeaders: createHeaders({
    provider: 'openai',
    apiKey: Axon AI_API_KEY,
    virtualKey: 'open-ai-key-04ba3e', // OpenAI virtual key
    config: CONFIG_ID
  })
});

const chatCompletion = await openai.chat.completions.create({
  messages,
  model: 'gpt-4'
});

console.log(chatCompletion.choices[0].message.content);
```

The approach to declare the Gateway Configs in the UI and reference them in the code is recommended since it keeps the Configs atomic and decoupled from the business logic and can be upgraded to add more features. What if you want to enable caching for all your thousands of requests? Just update the Configs from the UI. No commits. No redeploys.

### b. Reference Gateway Configs in the Code

Depending on the dynamics of your app, you might want to construct the Gateway Configs at the runtime. All you need to do is to pass the Gateway Configs directly to the `config` parameter as an argument.

#### Axon AI SDK

```js
import { Axon AI } from 'axon-ai';

const axon = new Axon AI({
  apiKey: 'xxxxxxx',
  virtualKey: 'maxxxxx8f4d',
  config: JSON.stringify({
    retry: {
      attempts: 3,
      on_status_codes: [429]
    }
  })
});

const messages = [
  {
    role: 'user',
    content: `What are the 7 wonders of the world?`
  }
];

const response = await axon.chat.completions.create({
  messages,
  model: 'gpt-4'
});

console.log(response.choices[0].message.content);
```

#### Axios

```js
import axios from 'axios';

const CONFIG_ID = {
  retry: {
    attempts: 3,
    on_status_codes: [429]
  }
};

const Axon AI_API_KEY = 'xxxxxxxx';
const OPENAI_API_KEY = 'sk-xxxxxxxxx';

const data = {
  model: 'gpt-4',
  messages: [
    {
      role: 'user',
      content: 'What are 7 wonders of the world?'
    }
  ]
};

const { data: response } = await axios({
  method: 'post',
  url: 'https://api.axon.ai/v1/chat/completions',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    'x-axon-api-key': Axon AI_API_KEY,
    'x-axon-provider': 'openai',
    'x-axon-config': JSON.stringify(CONFIG_ID)
  },
  data: data
});

console.log(response.choices[0].message.content);
```

#### OpenAI SDK

```js
import OpenAI from 'openai'; // We're using the v4 SDK
import { Axon AI_GATEWAY_URL, createHeaders } from 'axon-ai';

const Axon AI_API_KEY = 'xxxxxrk';
const CONFIG_ID = 'pc-reques-edf21c';

const messages = [
  {
    role: 'user',
    content: `What are the 7 wonders of the world?`
  }
];

const openai = new OpenAI({
  apiKey: 'OPENAI_API_KEY', // When you pass the parameter `virtualKey`, this value is ignored.
  baseURL: Axon AI_GATEWAY_URL,
  defaultHeaders: createHeaders({
    provider: 'openai',
    apiKey: Axon AI_API_KEY,
    virtualKey: 'open-ai-key-04ba3e', // OpenAI virtual key
    config: {
      retry: {
        attempts: 3,
        on_status_codes: [429]
      }
    }
  })
});

const chatCompletion = await openai.chat.completions.create({
  messages,
  model: 'gpt-4'
});

console.log(chatCompletion.choices[0].message.content);
```

Those are three ways to use Gateway Configs in your requests.

In the cases where you want to specifically add a config for a specific request instead of all, Axon AI allows you to pass `config` argument as seperate objects right at the time of chat completions call instead of `Axon AI({..})` instantiation.

```js
const response = await axon.chat.completions.create(
  {
    messages,
    model: 'gpt-4'
  },
  {
    config: 'config_id' // or expanded Config Object
  }
);
```

Applying retry super power to your requests is that easy!

## Next Steps: Dive into features of AI gateway

Great job on implementing the retry behavior for your LLM calls to OpenAI!

Gateway Configs is a tool that can help you manage fallbacks, request timeouts, load balancing, caching, and more. With Axon AI's support for over 100+ LLMs, it is a powerful tool for managing complex use cases that involve multiple target configurations. A Gateway Config that encompasses such complexity may look like:

```
TARGET 1 (root):
  OpenAI GPT4
  Simple Cache
  On 429:
    TARGET 2 (loadbalance):
      Anthropic Claude3
      Semantic Cache
      On 5XX
    TARGET 3 (loadbalance):
      Anyscale Mixtral 7B
      On 4XX, 5XX
        TARGET 4 (fallback):
          Llama Models
          Automatic Retries
          Request Timeouts
```

For complete reference, refer to the _[Config Object](https://axon.ai/docs/api-reference/config-object)_.

It's exciting to see all the AI gateway features available for your requests. Feel free to experiment and make the most of them. Keep up the great work!
