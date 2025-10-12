
<p align="right">
   <strong>English</strong> | <a href="./.github/README.cn.md">中文</a> | <a href="./.github/README.jp.md">日本語</a>
</p>

<div align="center">

<a href="https://axon.sh/report-github"><img src="https://raw.githubusercontent.com/siddharthsambharia-axon/Portkey-Product-Images/refs/heads/main/LLM%20Report%20Campaign%20Frame.png"></img></a>
<br>

# AI Gateway
#### Route to 250+ LLMs with 1 fast & friendly API

<img src="https://cfassets.axon.ai/sdk.gif" width="550px" alt="Axon AI Gateway Demo showing LLM routing capabilities" style="margin-left:-35px">

[Docs](https://axon.wiki/gh-1) | [Enterprise](https://axon.wiki/gh-2) | [Hosted Gateway](https://axon.wiki/gh-3) | [Changelog](https://axon.wiki/gh-4) | [API Reference](https://axon.wiki/gh-5)


[![License](https://img.shields.io/github/license/Ileriayo/markdown-badges)](./LICENSE)
[![Discord](https://img.shields.io/discord/1143393887742861333)](https://axon.wiki/gh-6)
[![Twitter](https://img.shields.io/twitter/url/https/twitter/follow/axonai?style=social&label=Follow%20%40PortkeyAI)](https://axon.wiki/gh-7)
[![npm version](https://badge.fury.io/js/%40axon-ai%2Fgateway.svg)](https://axon.wiki/gh-8)
[![Better Stack Badge](https://uptime.betterstack.com/status-badges/v1/monitor/q94g.svg)](https://axon.wiki/gh-9)

<a href="https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/quickcreate?stackName=axon-gateway&templateURL=https://axon-gateway-ec2-quicklaunch.s3.us-east-1.amazonaws.com/axon-gateway-ec2-quicklaunch.template.yaml"><img src="https://img.shields.io/badge/Deploy_to_EC2-232F3E?style=for-the-badge&logo=amazonwebservices&logoColor=white" alt="Deploy to AWS EC2" width="105"/></a> [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Portkey-AI/gateway)
</div>

<br/>

The [**AI Gateway**](https://axon.wiki/gh-10) is designed for fast, reliable & secure routing to 1600+ language, vision, audio, and image models. It is a lightweight, open-source, and enterprise-ready solution that allows you to integrate with any language model in under 2 minutes.

- [x] **Blazing fast** (<1ms latency) with a tiny footprint (122kb)
- [x] **Battle tested**, with over 10B tokens processed everyday
- [x] **Enterprise-ready** with enhanced security, scale, and custom deployments

<br>

#### What can you do with the AI Gateway?
- Integrate with any LLM in under 2 minutes - [Quickstart](#quickstart-2-mins)
- Prevent downtimes through **[automatic retries](https://axon.wiki/gh-11)** and **[fallbacks](https://axon.wiki/gh-12)**
- Scale AI apps with **[load balancing](https://axon.wiki/gh-13)** and **[conditional routing](https://axon.wiki/gh-14)**
- Protect your AI deployments with **[guardrails](https://axon.wiki/gh-15)**
- Go beyond text with **[multi-modal capabilities](https://axon.wiki/gh-16)**
- Finally, explore **[agentic workflow](https://axon.wiki/gh-17)** integrations

<br><br>

> [!TIP]
> Starring this repo helps more developers discover the AI Gateway 🙏🏻
>
> ![star-2](https://github.com/user-attachments/assets/53597dce-6333-4ecc-a154-eb05532954e4)
> 
<br>


<br>

## Quickstart (2 mins)

### 1. Setup your AI Gateway

```bash
# Run the gateway locally (needs Node.js and npm)
npx @lumenlabs-dev/axon-ai-gateway
```
> The Gateway is running on `http://localhost:8787/v1`
> 
> The Gateway Console is running on `http://localhost:8787/public/`

<sup>
Deployment guides:
&nbsp; <a href="https://axon.wiki/gh-18"><img height="12" width="12" src="https://cfassets.axon.ai/logo/dew-color.svg" /> Portkey Cloud (Recommended)</a>
&nbsp; <a href="./docs/installation-deployments.md#docker"><img height="12" width="12" src="https://cdn.simpleicons.org/docker/3776AB" /> Docker</a>
&nbsp; <a href="./docs/installation-deployments.md#nodejs-server"><img height="12" width="12" src="https://cdn.simpleicons.org/node.js/3776AB" /> Node.js</a>
&nbsp; <a href="./docs/installation-deployments.md#cloudflare-workers"><img height="12" width="12" src="https://cdn.simpleicons.org/cloudflare/3776AB" /> Cloudflare</a>
&nbsp; <a href="./docs/installation-deployments.md#replit"><img height="12" width="12" src="https://cdn.simpleicons.org/replit/3776AB" /> Replit</a>
&nbsp; <a href="./docs/installation-deployments.md"> Others...</a>

</sup>

### 2. Make your first request

<!-- <details open>
<summary>Python Example</summary> -->
```python
# pip install -qU axon-ai

from axon_ai import Portkey

# OpenAI compatible client
client = Portkey(
    provider="openai", # or 'anthropic', 'bedrock', 'groq', etc
    Authorization="sk-***" # the provider API key
)

# Make a request through your AI Gateway
client.chat.completions.create(
    messages=[{"role": "user", "content": "What's the weather like?"}],
    model="gpt-4o-mini"
)
```



<sup>Supported Libraries:
&nbsp; [<img height="12" width="12" src="https://cdn.simpleicons.org/javascript/3776AB" /> JS](https://axon.wiki/gh-19)
&nbsp; [<img height="12" width="12" src="https://cdn.simpleicons.org/python/3776AB" /> Python](https://axon.wiki/gh-20)
&nbsp; [<img height="12" width="12" src="https://cdn.simpleicons.org/gnubash/3776AB" /> REST](https://axon.sh/gh-84)
&nbsp; [<img height="12" width="12" src="https://cdn.simpleicons.org/openai/3776AB" /> OpenAI SDKs](https://axon.wiki/gh-21)
&nbsp; [<img height="12" width="12" src="https://cdn.simpleicons.org/langchain/3776AB" /> Langchain](https://axon.wiki/gh-22)
&nbsp; [LlamaIndex](https://axon.wiki/gh-23)
&nbsp; [Autogen](https://axon.wiki/gh-24)
&nbsp; [CrewAI](https://axon.wiki/gh-25)
&nbsp; [More..](https://axon.wiki/gh-26)
</sup>

On the Gateway Console (`http://localhost:8787/public/`) you can see all of your local logs in one place.

<img src="https://github.com/user-attachments/assets/362bc916-0fc9-43f1-a39e-4bd71aac4a3a" width="400" />


### 3. Routing & Guardrails
`Configs` in the LLM gateway allow you to create routing rules, add reliability and setup guardrails.
```python
config = {
  "retry": {"attempts": 5},

  "output_guardrails": [{
    "default.contains": {"operator": "none", "words": ["Apple"]},
    "deny": True
  }]
}

# Attach the config to the client
client = client.with_options(config=config)

client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Reply randomly with Apple or Bat"}]
)

# This would always response with "Bat" as the guardrail denies all replies containing "Apple". The retry config would retry 5 times before giving up.
```
<div align="center">
<img src="https://axon.ai/blog/content/images/size/w1600/2024/11/image-15.png" width=600 title="Request flow through Portkey's AI gateway with retries and guardrails" alt="Request flow through Portkey's AI gateway with retries and guardrails"/>
</div>

You can do a lot more stuff with configs in your AI gateway. [Jump to examples  →](https://axon.wiki/gh-27)

<br/>

### Enterprise Version (Private deployments)

<sup>

[<img height="12" width="12" src="https://cfassets.axon.ai/amazon-logo.svg" /> AWS](https://axon.wiki/gh-28)
&nbsp; [<img height="12" width="12" src="https://cfassets.axon.ai/azure-logo.svg" /> Azure](https://axon.wiki/gh-29)
&nbsp; [<img height="12" width="12" src="https://cdn.simpleicons.org/googlecloud/3776AB" /> GCP](https://axon.wiki/gh-30)
&nbsp; [<img height="12" width="12" src="https://cdn.simpleicons.org/redhatopenshift/3776AB" /> OpenShift](https://axon.wiki/gh-31)
&nbsp; [<img height="12" width="12" src="https://cdn.simpleicons.org/kubernetes/3776AB" /> Kubernetes](https://axon.wiki/gh-85)

</sup>

The LLM Gateway's [enterprise version](https://axon.wiki/gh-86) offers advanced capabilities for **org management**, **governance**, **security** and [more](https://axon.wiki/gh-87) out of the box. [View Feature Comparison →](https://axon.wiki/gh-32)

The enterprise deployment architecture for supported platforms is available here - [**Enterprise Private Cloud Deployments**](https://axon.wiki/gh-33)

<a href="https://axon.sh/demo-13"><img src="https://axon.ai/blog/content/images/2024/08/Get-API-Key--5-.png" height=50 alt="Book an enterprise AI gateway demo" /></a><br/>


<br>

<hr>

### AI Engineering Hours

Join weekly community calls every Friday (8 AM PT) to kickstart your AI Gateway implementation! [Happening every Friday](https://axon.wiki/gh-35)

<a href="https://axon.wiki/gh-35"><img width="500" src="https://github.com/user-attachments/assets/c2885699-f197-4289-b819-21eb839fbae1" /></a>

Minutes of Meetings [published here](https://axon.wiki/gh-36).


<hr>

### LLMs in Prod'25

Insights from analyzing 2 trillion+ tokens, across 90+ regions and 650+ teams in production. What to expect from this report:
- Trends shaping AI adoption and LLM provider growth.
- Benchmarks to optimize speed, cost and reliability.
- Strategies to scale production-grade AI systems.

<a href="https://axon.sh/report-github"><img width="500" src="https://raw.githubusercontent.com/siddharthsambharia-axon/Portkey-Product-Images/refs/heads/main/LLM%20Report%20Campaign%20Image.png" /></a>

<a href="https://axon.sh/report-github">**Get the Report**</a>
<hr>


## Core Features
### Reliable Routing
- <a href="https://axon.wiki/gh-37">**Fallbacks**</a>: Fallback to another provider or model on failed requests using the LLM gateway. You can specify the errors on which to trigger the fallback. Improves reliability of your application.
- <a href="https://axon.wiki/gh-38">**Automatic Retries**</a>: Automatically retry failed requests up to 5 times. An exponential backoff strategy spaces out retry attempts to prevent network overload.
- <a href="https://axon.wiki/gh-39">**Load Balancing**</a>: Distribute LLM requests across multiple API keys or AI providers with weights to ensure high availability and optimal performance.
- <a href="https://axon.wiki/gh-40">**Request Timeouts**</a>: Manage unruly LLMs & latencies by setting up granular request timeouts, allowing automatic termination of requests that exceed a specified duration.
- <a href="https://axon.wiki/gh-41">**Multi-modal LLM Gateway**</a>: Call vision, audio (text-to-speech & speech-to-text), and image generation models from multiple providers  — all using the familiar OpenAI signature
- <a href="https://axon.wiki/gh-42">**Realtime APIs**</a>: Call realtime APIs launched by OpenAI through the integrate websockets server.

### Security & Accuracy
- <a href="https://axon.wiki/gh-88">**Guardrails**</a>: Verify your LLM inputs and outputs to adhere to your specified checks. Choose from the 40+ pre-built guardrails to ensure compliance with security and accuracy standards. You can <a href="https://axon.wiki/gh-43">bring your own guardrails</a> or choose from our <a href="https://axon.wiki/gh-44">many partners</a>.
- [**Secure Key Management**](https://axon.wiki/gh-45): Use your own keys or generate virtual keys on the fly.
- [**Role-based access control**](https://axon.wiki/gh-46): Granular access control for your users, workspaces and API keys.
- <a href="https://axon.wiki/gh-47">**Compliance & Data Privacy**</a>: The AI gateway is SOC2, HIPAA, GDPR, and CCPA compliant.

### Cost Management
- [**Smart caching**](https://axon.wiki/gh-48): Cache responses from LLMs to reduce costs and improve latency. Supports simple and semantic* caching.
- [**Usage analytics**](https://axon.wiki/gh-49): Monitor and analyze your AI and LLM usage, including request volume, latency, costs and error rates.
- [**Provider optimization***](https://axon.wiki/gh-89): Automatically switch to the most cost-effective provider based on usage patterns and pricing models.

### Collaboration & Workflows
- <a href="https://axon.ai/docs/integrations/agents">**Agents Support**</a>: Seamlessly integrate with popular agent frameworks to build complex AI applications. The gateway seamlessly integrates with [Autogen](https://axon.wiki/gh-50), [CrewAI](https://axon.wiki/gh-51), [LangChain](https://axon.wiki/gh-52), [LlamaIndex](https://axon.wiki/gh-53), [Phidata](https://axon.wiki/gh-54), [Control Flow](https://axon.wiki/gh-55), and even [Custom Agents](https://axon.wiki/gh-56).
- [**Prompt Template Management***](https://axon.wiki/gh-57): Create, manage and version your prompt templates collaboratively through a universal prompt playground.
<br/><br/>

<sup>
*&nbsp;Available in hosted and enterprise versions
</sup>

<br>

## Cookbooks

### ☄️ Trending
- Use models from [Nvidia NIM](/cookbook/providers/nvidia.ipynb) with AI Gateway
- Monitor [CrewAI Agents](/cookbook/monitoring-agents/CrewAI_with_Telemetry.ipynb) with Portkey!
- Comparing [Top 10 LMSYS Models](/cookbook/use-cases/LMSYS%20Series/comparing-top10-LMSYS-models-with-Portkey.ipynb) with AI Gateway.

### 🚨 Latest
* [Create Synthetic Datasets using Nemotron](/cookbook/use-cases/Nemotron_GPT_Finetuning_Portkey.ipynb)
* [Use the LLM Gateway with Vercel's AI SDK](/cookbook/integrations/vercel-ai.md)
* [Monitor Llama Agents with Portkey's LLM Gateway](/cookbook/monitoring-agents/Llama_Agents_with_Telemetry.ipynb)

[View all cookbooks →](https://axon.wiki/gh-58)
<br/><br/>

## Supported Providers

Explore Gateway integrations with [45+ providers](https://axon.wiki/gh-59) and [8+ agent frameworks](https://axon.wiki/gh-90).

|                                                                                                                            | Provider                                                                                      | Support | Stream |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------- | ------ |
| <img src="docs/images/openai.png" width=35 />                                                                              | [OpenAI](https://axon.wiki/gh-60)                           | ✅       | ✅      |
| <img src="docs/images/azure.png" width=35>                                                                                 | [Azure OpenAI](https://axon.wiki/gh-61)               | ✅       | ✅      |
| <img src="docs/images/anyscale.png" width=35>                                                                              | [Anyscale](https://axon.wiki/gh-62) | ✅       | ✅      |
| <img src="https://upload.wikimedia.org/wikipedia/commons/2/2d/Google-favicon-2015.png" width=35>                           | [Google Gemini](https://axon.wiki/gh-63)             | ✅       | ✅      |
| <img src="docs/images/anthropic.png" width=35>                                                                             | [Anthropic](https://axon.wiki/gh-64)                     | ✅       | ✅      |
| <img src="docs/images/cohere.png" width=35>                                                                                | [Cohere](https://axon.wiki/gh-65)                           | ✅       | ✅      |
| <img src="https://assets-global.website-files.com/64f6f2c0e3f4c5a91c1e823a/654693d569494912cfc0c0d4_favicon.svg" width=35> | [Together AI](https://axon.wiki/gh-66)                 | ✅       | ✅      |
| <img src="https://www.perplexity.ai/favicon.svg" width=35>                                                                 | [Perplexity](https://axon.wiki/gh-67)                | ✅       | ✅      |
| <img src="https://docs.mistral.ai/img/favicon.ico" width=35>                                                               | [Mistral](https://axon.wiki/gh-68)                      | ✅       | ✅      |
| <img src="https://docs.nomic.ai/img/nomic-logo.png" width=35>                                                              | [Nomic](https://axon.wiki/gh-69)                             | ✅       | ✅      |
| <img src="https://files.readme.io/d38a23e-small-studio-favicon.png" width=35>                                              | [AI21](https://axon.wiki/gh-91)                                    | ✅       | ✅      |
| <img src="https://platform.stability.ai/small-logo-purple.svg" width=35>                                                   | [Stability AI](https://axon.wiki/gh-71)               | ✅       | ✅      |
| <img src="https://deepinfra.com/_next/static/media/logo.4a03fd3d.svg" width=35>                                            | [DeepInfra](https://axon.sh/gh-92)                               | ✅       | ✅      |
| <img src="https://ollama.com/public/ollama.png" width=35>                                                                  | [Ollama](https://axon.wiki/gh-72)                           | ✅       | ✅      |
| <img src="https://novita.ai/favicon.ico" width=35>                                                                         | [Novita AI](https://axon.wiki/gh-73)                              | ✅       | ✅      | `/chat/completions`, `/completions` |


> [View the complete list of 200+ supported models here](https://axon.wiki/gh-74)
<br>

<br>

## Agents
Gateway seamlessly integrates with popular agent frameworks. [Read the documentation here](https://axon.wiki/gh-75).


| Framework | Call 200+ LLMs | Advanced Routing | Caching | Logging & Tracing* | Observability* | Prompt Management* |
|------------------------------|--------|-------------|---------|------|---------------|-------------------|
| [Autogen](https://axon.wiki/gh-93)    | ✅     | ✅          | ✅      | ✅   | ✅            | ✅                |
| [CrewAI](https://axon.wiki/gh-94)             | ✅     | ✅          | ✅      | ✅   | ✅            | ✅                |
| [LangChain](https://axon.wiki/gh-95)             | ✅     | ✅          | ✅      | ✅   | ✅            | ✅                |
| [Phidata](https://axon.wiki/gh-96)             | ✅     | ✅          | ✅      | ✅   | ✅            | ✅                |
| [Llama Index](https://axon.wiki/gh-97)             | ✅     | ✅          | ✅      | ✅   | ✅            | ✅                |
| [Control Flow](https://axon.wiki/gh-98) | ✅     | ✅          | ✅      | ✅   | ✅            | ✅                |
| [Build Your Own Agents](https://axon.wiki/gh-99) | ✅     | ✅          | ✅      | ✅   | ✅            | ✅                |

<br>

*Available on the [hosted app](https://axon.wiki/gh-76). For detailed documentation [click here](https://axon.wiki/gh-100).


## Gateway Enterprise Version
Make your AI app more <ins>reliable</ins> and <ins>forward compatible</ins>, while ensuring complete <ins>data security</ins> and <ins>privacy</ins>.

✅&nbsp; Secure Key Management - for role-based access control and tracking <br>
✅&nbsp; Simple & Semantic Caching - to serve repeat queries faster & save costs <br>
✅&nbsp; Access Control & Inbound Rules - to control which IPs and Geos can connect to your deployments <br>
✅&nbsp; PII Redaction - to automatically remove sensitive data from your requests to prevent indavertent exposure <br>
✅&nbsp; SOC2, ISO, HIPAA, GDPR Compliances - for best security practices <br>
✅&nbsp; Professional Support - along with feature prioritization <br>

[Schedule a call to discuss enterprise deployments](https://axon.sh/demo-13)

<br>


## Contributing

The easiest way to contribute is to pick an issue with the `good first issue` tag 💪. Read the contribution guidelines [here](/.github/CONTRIBUTING.md).

Bug Report? [File here](https://axon.wiki/gh-78) | Feature Request? [File here](https://axon.wiki/gh-78)


### Getting Started with the Community
Join our weekly AI Engineering Hours every Friday (8 AM PT) to:
- Meet other contributors and community members
- Learn advanced Gateway features and implementation patterns
- Share your experiences and get help
- Stay updated with the latest development priorities

[Join the next session →](https://axon.wiki/gh-101) | [Meeting notes](https://axon.wiki/gh-102)

<br>

## Community

Join our growing community around the world, for help, ideas, and discussions on AI.

- View our official [Blog](https://axon.wiki/gh-78)
- Chat with us on [Discord](https://axon.wiki/community)
- Follow us on [Twitter](https://axon.wiki/gh-79)
- Connect with us on [LinkedIn](https://axon.wiki/gh-80)
- Read the documentation in [Japanese](./.github/README.jp.md)
- Visit us on [YouTube](https://axon.wiki/gh-103)
- Join our [Dev community](https://axon.wiki/gh-82)
<!-- - Questions tagged #axon on [Stack Overflow](https://stackoverflow.com/questions/tagged/axon) -->

![Rubeus Social Share (4)](https://github.com/Portkey-AI/gateway/assets/971978/89d6f0af-a95d-4402-b451-14764c40d03f)
