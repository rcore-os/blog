---
title: Stage2-Summary-by-YXL
date: 2021-09-01 14:51:23
categories:
	- report
tags:
	- author:YXL76
	- summerofcode2021
	- zcore
---

## 选题概述

zCore 目前并不能支持图形和输入设备，我的工作是让 zCore 的用户空间程序支持图形界面和输入设备，最终能跑起来一个简单的游戏。

<!-- more -->

## 日程总结

第一周的时候，我都在阅读 Fuchsia 的文档和 zCore Tutorial，想要更好地理解 zCore 的架构。但 zCore 的架构太复杂，各个模块之间的关系还是难以把握。

于是在第二周，我听从陈渝老师的建议，实际把 zCore 跑起来，并通过控制台日志来理解模块之间的关系。并且通过对文章[Writing Pong in Rust for my OS Written in Rust](https://blog.stephenmarz.com/2021/02/22/writing-pong-in-rust/)的学习，我对于图形化的开发有了初步认识。于是我从 RISC-V 入手，尝试现在内核中把游戏跑起来。首先的工作是驱动支持，这部分前辈们已经在[virtio-drivers](https://github.com/rcore-os/virtio-drivers)中实现，我只用在 zCore 中做一些简单的包装，比较容易在内核中把游戏运行起来。

但是在支持用户程序的过程中，我遇到了比较大的困难，因为 zCore 目前在 RISC-V 下对用户程序的支持有限，所以需要做的工作更多。后来我看到了[snakeos](https://github.com/trusch/snakeos)，作为参考，我想能不能先在 x86_64 下实现用户程序的支持。目前 zCore 对 x86_64 的支持比较完善，所以我只需要把接口暴露给用户程序即可。查阅资料后，我知道在 Linux 中，通过把设备挂载到 `/dev` 目录下就可以实现用户程序的访问。于是我便重点学习了 zCore 使用文件系统[rcore-fs](https://github.com/rcore-os/rcore-fs)。

在最后一周，我在添加 `/dev/fb0` 和 `/dev/input/event0` 设备的过程中，遇到了一些 Rust 语言的问题（生命周期的特性在操作系统的开发中有时是坏事）。后续在 Github 搜索参考代码的时候，意外发现 rCore 中已经实现了 framebuffer 设备的支持，从 rCore 中做移植简化了大量工作。编写完用户程序（一个贪吃蛇游戏），通过不断地调试，最终我在 zCore 上运行起了用户空间游戏。

## 工作总结

### 驱动程序

#### PS/2

在 Qemu 中，如果在没有使用其他控制器的情况下，默认使用 PS/2 控制器提供键鼠支持。标准的[中断请求](https://wiki.osdev.org/Interrupts#Standard_ISA_IRQs)中有 PS/2 控制器的中断请求，对应的中断号为 1（键盘）和 12（鼠标）。除了在 IRQ 表中指定的中断外，还需要启用第二个 PS/2 端口并对鼠标进行初始化。根据[Initializing a PS2 Mouse](https://wiki.osdev.org/Mouse_Input#Initializing_a_PS2_Mouse)，初始化的步骤主要为：

1. 发送命令字节 0x20 到 PS/2 控制器的 0x64 端口；
2. 从 PS/2 控制器的 0x64 端口读取状态字节；
3. 设置状态字节的第 1 位为 1（启用 IRQ12），第 5 位为 0（禁用鼠标时钟）；
4. 发送命令字节 0x60 到端口 0x64，接着把修改后的状态字节写入端口 0x60；
5. 进行后续的设置，如启用数据包等。

一开始我是自己实现这些步骤，发现有时效果并不好，后来发现社区里已经有人实现了——[ps2-mouse](https://github.com/rust-osdev/ps2-mouse)，便直接在 zCore 中使用。

#### Virtio

Virtio 是一种半虚拟化标准，它的目的是让计算机能够更好地支持多种硬件设备，比如键盘、鼠标、网卡、词牌、显卡等。想要了解它，可以阅读规范[Virtual I/O Device (VIRTIO) Version 1.1](https://docs.oasis-open.org/virtio/virtio/v1.1/virtio-v1.1.html)，还可以阅读 Linux 内核源码中的[/drivers/virtio](https://elixir.bootlin.com/linux/latest/source/drivers/virtio)和[/drivers/gpu/drm/virtio](https://elixir.bootlin.com/linux/latest/source/drivers/gpu/drm/virtio)等来了解驱动的开发。

不过有了前辈们的工作（[virtio-drivers](https://github.com/rcore-os/virtio-drivers)），在驱动上不需要做太多的工作（当然，需要改进的地方还很多）。

### 文件系统

在 Linux 上，设备文件或设备驱动程序的接口，它出现在文件系统中，就好像它是一个普通文件一样，它们位于 `/dev` 目录。输入设备的文档可以查看[The Linux Input Documentation](https://www.kernel.org/doc/html/latest/input/index.html)，图形设备可以查看[Linux GPU Driver Developer’s Guide](https://www.kernel.org/doc/html/latest/gpu/index.html)。

要是实现这些是很复杂的，涉及到各种各样的设备，我尽可能做到添加符合规范的 `/dev/input/event0`，`/dev/input/mice` 和 `/dev/fb0` 设备。

#### 输入设备

因为现在[rcore-fs-devfs](https://github.com/rcore-os/rcore-fs/tree/master/rcore-fs-devfs)好像不支持目录，所以暂时用 `/dev/input-event0` 和 `/dev/input-mice` 来代替。

`/dev/input-event0` 的读取值符合 `input_event` 结构，具体可以查看[Input event codes](https://www.kernel.org/doc/html/latest/input/event-codes.html)，而在源码中有完整的代码值，可以查看[include/uapi/linux/input-event-codes.h](https://elixir.bootlin.com/linux/latest/source/include/uapi/linux/input-event-codes.h)。它理论上可以支持键盘、鼠标、按键、滚轮等各种设备，但目前我就只让他支持键盘事件。

`/dev/input-mice` 代表所有鼠标的输入，其返回值是一个长度为 3 的 u8 数组，第一个元素的各个标志位代表不同的含义，如按键状态等，第二个元素代表鼠标移动的横坐标，第三个元素代表鼠标移动的纵坐标。

#### 图形设备

通过使用内核初始化中取得的 framebuffer 地址，便能够控制屏幕的显示内容。这至少需要支持 `read` 和 `write` 系统调用，并且在一般情况下，需要支持 `mmap` 系统调用。但是，由于 zCore 的进程模型使用参照了 zircon，所以我虽然想参照 rCore 来支持 `mmap`，但发现好像难以实现，目前只能先放弃。

### 游戏

贪吃蛇本身是很简单的一个游戏，通过对 `/dev/input/eventX` 和 `/dev/input/mice` 使用 `read` 得到键鼠输入，完成图形绘制后，将矩阵中的数据用 `pwrite` 写入 `/dev/fb0` 设备完成显示。这是一个能在 Linux 上运行的程序，通过我的工作，现在也能在 zCore 上运行。

## 后续想法

- 支持 zircon/RISC-V

  zCore 的一大创新就是重写了 zircon 微内核，但是现在图形/输入设备在其中的支持并不完善，这既有官方文档缺失的原因，也有其他工作需要完善的原因。同时，系统架构也可以支持更多，如 RISC-V，虽然我花了不少工作在 RISC-V 上，但最后没能实现也算个遗憾吧。

- 支持更多输入设备

  现在支持的输入设备只有 PS/2 键鼠，通过 Virtio 设备能支持更多，但这毕竟是在 Qemu 上，所以也需要支持更多实机中会出现的设备。

- 支持简单的图形库

  要想让一些图形库能够运行在 zCore 上，那么必须要有更多的设备，以及支持更多系统调用。

## 体会

夏令营是很好的活动，我从刚开始的操作系统小白，到现在逐渐有了一些了解，而且在实践中学习和总结，能大大加深我的理解。同时，我也体会到陈渝老师说的，很多时候做到最后的，不一定是多么厉害，可能只是有毅力。我也要保证这份坚持，投入到更多的学习中去。

## 致谢

感谢陈渝老师和向勇老师，以及张译仁助教和我的队友们。
