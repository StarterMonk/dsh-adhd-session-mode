# dsh-adhd-session-mode

由 GitHub 上的 Skill 项目 [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) **转换而来的** [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）插件。它**只在单个会话中生效，从不全局生效**。

一个系统提示词区段改变助手的回复方式——行动先行、步骤编号、时间估算用真实单位、不写开场白与收尾语——并且每个会话各自决定开还是关。

## 来源

上游是一份给多个编码助手使用的输出风格 skill，本身不含任何 DeepSeek Harness 代码。本仓库把它的规则集移植到 DSH，并补上原项目没有对应物的 harness 集成：一个系统提示词区段、一条 `/i-have-adhd` 命令、一个承载每会话状态的会话日志投影，以及输入框下方的一枚徽标。

[`skill/SKILL.md`](./skill/SKILL.md) 里的规则正文来自上游，按 MIT 许可逐字保留——见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)。其余部分均为原创。

## 为什么是按会话

输出风格不是一项全局偏好，它取决于这段对话是拿来做什么的。

有些时候你需要模型把一件事讲清楚：讲透一个机制、权衡几个方案、回答一个「细节本身就是答案」的问题。这种场合下，把每段回复压成一张编号行动清单反而是干扰。另一些时候你是在执行：你已经知道要什么，只想拿到下一步，周围的东西都是成本，五行铺垫纯粹是浪费。

一个全局开关必然让其中一边吃亏。所以这个插件把开关做成了会话的属性：

- 在执行型的会话里打开它。
- 在阅读和思考型的会话里让它保持关闭。
- 两者可以同时开着，互不记得对方的选择。

它不是那种「设一次就忘掉」的配置，而是一个按对话做的决定——因为这件事本来就是在对话这个粒度上决定的。

## 安装

```sh
dsh plugin --profile <你的-profile> add dsh-adhd-session-mode
```

从源码仓库安装：

```sh
dsh plugin --profile <你的-profile> add github:StarterMonk/dsh-adhd-session-mode
```

装完需要重启 DeepSeek Harness —— 本插件的行是一条 bundle patch，首次激活必须重启。

## 使用

在你想要塑形的那个会话里：

```
/i-have-adhd on
```

`/i-have-adhd off` 关闭，不带参数的 `/i-have-adhd` 则切换。你也可以直接当成普通消息说 **stop adhd mode**（或 **normal mode**）——短语是按整条消息匹配的，所以 `how do I stop adhd mode?` 会被当作提问而不是命令。

某个会话开启期间，输入框下方会有一枚 `● ADHD ON` 徽标，状态不需要你记。

如果想让每个会话默认就开着，可以在 profile patch 里覆盖该行的配置：

```yaml
- id: i-have-adhd
  name: dsh-adhd-session-mode
  config:
    alwaysOn: true
```

## 工作原理

| 部件 | 作用 |
| --- | --- |
| 系统提示词区段 | 会话开启期间，把规则集带进每一个模型步。order 为 `10150` —— 在所有工具说明、harness 源码与 web surface 之后，紧邻 persona 收尾段之前，让风格指令最后落地。 |
| 会话投影 | 模式**从会话日志派生**，不是存下来的设置。`/i-have-adhd on` 持久化为 `command/run`，打字说出的 `stop adhd mode` 持久化为 `user/message`。折叠这两类事件意味着会话被 resume 或 fork 时，模式能正确重放。 |
| `/i-have-adhd` 命令 | 开关本体。该命令声明了 `input`，这正是客户端会把 `/i-have-adhd on` 路由进命令、而不是把整行当文本发给模型的原因。 |
| 技能 | 规则全文同时注册为一个按需技能，想读全文时可以直接加载，而不会顺带打开模式。 |
| 客户端徽标 | 通过 `useProjection` 读该会话的投影状态，渲染在输入框下方。不 import 任何 Harness 客户端包；配色只用 `--dsw-alias-*` 主题 token。 |

**不往 `$DSH_HOME` 写任何东西，也不写配置文件。** 没有需要去找的 flag 文件，卸载时也没有残留要清理。

## 与其它 ADHD 插件的关系

这个方向上有几个插件在做不同的事，说清楚比较有用：

| 插件 | 做的事 |
| --- | --- |
| [`dsh-i-have-adhd`](https://github.com/yongshuai0314/dsh-i-have-adhd) | 塑形助手回复。一个 order 50 的系统提示词区段，加三个零参数工具（`adhd_on` / `adhd_off` / `adhd_status`），并用 `$DSH_HOME` 下的**全局** flag 文件在启动时恢复模式。 |
| [`dsh-adhd-copilot`](https://github.com/zimai233/dsh-adhd-copilot) | 教练用户：拆任务、做启动仪式。 |
| [`adhdgofly-dsh-ext`](https://github.com/zuoguyoupan2023/adhdgofly-dsh-ext) | 在渲染后的 Markdown 里高亮词性。 |
| **本插件** | 塑形助手回复，但开关的作用域是**单个会话**，状态存在该会话的日志里。 |

与 `dsh-i-have-adhd` 的实质差别在开关的作用域与状态的存放位置。全局 flag 文件表达不了「这里开、那里关」；按会话的投影可以，而且因为投影折叠的是会话日志而不是持有一个变量，答案在 resume 与 fork 之后天然仍然正确，不需要额外记账。代价在控制面：`dsh-i-have-adhd` 可以直接说一句 *adhd mode on*，因为模型手上有工具；本插件需要你打斜杠命令。

两者都源自 [`ayghri/i-have-adhd`](https://github.com/ayghri/i-have-adhd) 的同一个想法。

## 已知限制

- **被委派的子代理不会继承模式。** 子代理在自己的会话里运行，而模式是按会话的，所以子代理用默认风格写作，父子之间的语域会不一致。要让子代理继承，得把父会话的状态穿进投影的 `init`，目前没有实现。
- **一个会话一个模式，不是一轮一个。** 开关影响该会话的后续所有轮次。
- **注入的规则集是指令，不是保证。** 它塑形模型的输出，但无法强制服从。判断它是否有效，要读几段真实回复。

## 规则集

十条规则，按便于略读的方式分组——全文见 [`skill/SKILL.md`](./skill/SKILL.md)：

**形态** · 首行即行动 · 步骤编号 · 收尾给一个下一步 · 支线靠边
**状态** · 每轮复述进度 · 时间估算用真实单位 · 让成果可见
**语气** · 错误只陈述事实 · 列表不超过五条 · 不说客套话

并带有明确的覆盖规则：harness 规则优先于本模式；「explain」类请求保留形态但放开深度；破坏性操作仍然先确认；连续三轮调试失败就停下来问一个诊断性问题，而不是继续改代码。

## 许可证

MIT。规则正文逐字取自 [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd)（MIT）—— 见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)，其中完整保留了上游的许可文本。其余部分均为原创。
