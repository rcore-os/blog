---
title: 2024秋冬季开源操作系统训练营项目1方向2总结-shj
date: 2024-12-20 20:20:20
categories:
    - 2024秋冬季开源操作系统训练营项目1方向2总结
tags:
    - author: Foreverhighness
    - repo: https://github.com/Foreverhighness/igb-driver-from-ixgbe
---

## 碎碎念

因为之前在忙别的事情，所以晚了一周进组，写代码更是只剩两天时间，所以对代码基本是能跑就行的态度。

不过也有好处，因为晚开始所以资料会比一开始弄多点，开始写的时候就基本能 link up 了。

## 找参考资料

最重要的参考资料自然是 Intel 82576 手册。不过如果有代码参考肯定是更好的。

ArceOS 自己项目里面就有一个 ixgbe 的驱动，虽然是不同型号的网卡，但是部分逻辑可以参考，而且是 Rust 编写，很好理解。

其次就是 igb 官方驱动，在 github 上可以找到，参考资料里也给了链接。

我简单瞟了两眼，里面感觉到这估计在 linux kernel 源码里也有一份，一搜果然有。

正好我机器上有一份之前用来学习的 linux 源码，配置一下正好可以看看。

## Linux src

把 CONFIG_IGB 开起来，编译一下再 gen_compile_commands.py 生成下 compile_commands.json 就可以愉快的跳转了。

驱动初始化代码在 `__igb_open` 里，感觉把这玩意实现了应该就可以了。

为了方便实现，我直接跳过了 Flow Control 的部分，感觉应该不会有太大问题。

参考里一直到初始化 link 和 phy 的部分都挺好懂，但是到初始化 rx 和 tx 的时候就开始有点艰难了。

## ethernet-intel-igb v1.0.1

于是我又转头看 github 上 igb 驱动的代码，不过我特意切换到了 v1.0.1 的 tag 上，一般越早期的代码越简单越好懂。

果然这里的初始化很简单，搞了几个寄存器就完了。

不过 v1.0.1 用的地址都是 alias 地址，我还是自己查了查手册，把正确的地址定义到常量上搞完的。

开启中断的方式在代码里也挺简单的。

不过让我觉得意外的是，老师给的关中断的方式和 igb C 驱动的方式并不一致，我最终决定参考 C 驱动的方式来关闭中断和开启中断。

## Ring

到了 Ring 部分就困难了，我直接放弃了自己写，正好群里有人提到 ixgbe 改改就能用，我就决定直接把我写完的初始化部分放到 ixgbe 里头跑。

把 ixgbe fork 下来，加一层 axdriver_net 的实现，把类型名重置一下，再在 ArceOS 的 Cargo.toml 里头改下依赖名字，把 ixgbe.rs 里的 Hal 实现复制一份到 driver.rs 里，一通操作下来先让程序可以编译。

把原来的东西直接改写进去就能跑 httpclient 了，非常的快乐。

但是跑 http server 时会遇到 curl 不通的情况。原因是没有在 RCTL 里加入 BAM flag, 加上就好了。

我自己 debug 的时候发现现象是收不到包，所以中途加过 BAM flag, 但是因为图省事写成 0x8000 的形式，没有单独弄一个 const value 去存。

结果当时 typo 打成了 0x800 或者 0x80000, 导致 bug 还在，后来 revert 的时候就删掉了。

我跑 http client 的时候发现实际上是可以正常收包的，所以怀疑是 host 机器不能直接发包到 qemu 里，于是在 http server 源码里开了个 http client 来 request, 结果就 OK 了。

当时不明所以，不过群里问了下发现正确做法是加 BAM flag, 于是就可以直接在 host 机器上连接到 server 了。
