---
title: 2024开源操作系统训练营第二阶段总结-OSFantasy
date: 2024-05-19 19:16:19
tags:
  - author:OSFantasy
  - repo:https://github.com/LearningOS/2024s-rcore-OSFantasy
---
# 第二阶段 - OS设计实现
## 0 前言
由于我是二刷了，所以一阶段很快就搞完了，然后提前了一个月左右弄二阶段。最后赶在了五一假期前做完了二阶段的Lab。（PS：不得不说，群友都好强，Orz）

然后我五一假期过后，训练营学习基本上就有些摆了（除了上课就没干啥了）。一方面原因是学校课程忽然要考试了，二是不得不重视英语学习了，三是自制力下降了很多。

![融化](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/%E8%9E%8D%E5%8C%96.png)

虽然是二刷训练营了，但是这次是第一次参与到二阶段的学习中（上次二阶段还没开始就没搞了）。不得不说二阶段真的学到了好多关于OS相关的知识，同时代码的实操非常有用。（PS：Tutorial-Book-V3的step-by-step真的很棒）

我本人是非计算机专业的，对于本次二阶段来说，基本上算是零基础了（没学过计组、操作系统概论、CSAPP、计算机体系结构等）。不过好在的是我对于单片机的开发还是比较熟悉的，在二阶段的学习中我也发现了OS开发和单片机开发的很多相似之处，比如：STM32有个东西叫HAL库，OS中有个东西叫HAL层(也就是SBI)，它两都是对硬件的一层抽象。

## 1 环境与工具软件等
### RustRover
还是强推RustRover。毕竟rCore的代码量可不小，用vim在多个文件间切换太麻烦了。而且RR可以方便的查看函数的使用和trait的impl。

![RR](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202024-05-19%20194056.png)

另外提一下，我在使用Ubuntu22上的RR2024.3时遇到了闪退问题。换回到RR2023后解决了。

### qemu
这个主要是用来模拟一个risc-v64的机器在我们的x86_64的电脑上。

在安装的时候可能会遇到一个坑，就是在执行：

```
# 安装编译所需的依赖包
sudo apt install autoconf automake autotools-dev curl libmpc-dev libmpfr-dev libgmp-dev \
              gawk build-essential bison flex texinfo gperf libtool patchutils bc \
              zlib1g-dev libexpat-dev pkg-config  libglib2.0-dev libpixman-1-dev libsdl2-dev libslirp-dev \
              git tmux python3 python3-pip ninja-build
# 下载源码包
# 如果下载速度过慢可以使用我们提供的百度网盘链接：https://pan.baidu.com/s/1dykndFzY73nqkPL2QXs32Q
# 提取码：jimc
wget https://download.qemu.org/qemu-7.0.0.tar.xz
# 解压
tar xvJf qemu-7.0.0.tar.xz
# 编译安装并配置 RISC-V 支持
cd qemu-7.0.0
./configure --target-list=riscv64-softmmu,riscv64-linux-user  # 在第九章的实验中，可以有图形界面和网络。如果要支持图形界面，可添加 " --enable-sdl" 参数；如果要支持网络，可添加 " --enable-slirp" 参数
make -j$(nproc)
```

而后，可能会报错说缺少某个东西。这是因为第一步操作可能少了个需要的依赖。按照提示执行

```
sudo apt install <缺少的某个依赖>
```

## 2 OS知识
### 操作系统概述
站在应用程序的角度来看，我们可以发现常见的应用程序其实是运行在由硬件、操作系统内核、运行时库、图形界面支持库等所包起来的一个 执行环境 (Execution Environment) 中，如下图所示。

![OS结构](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202024-05-19%20204200.png)

### 异常控制流
在操作系统中，需要处理三类异常控制流：外设中断 (Device Interrupt) 、陷入 (Trap) 和异常 (Exception，也称Fault Interrupt)。

陷入 (Trap) 是程序在执行过程中由于要通过系统调用请求操作系统服务而有意引发的事件。产生陷入后，操作系统需要执行系统调用服务来响应系统调用请求，这会破坏陷入前应用程序的控制流上下文，所以操作系统要保存与恢复陷入前应用程序的控制流上下文。

![异常控制流：陷入](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202024-05-19%20232241.png)

### RISC-V 特权级架构
RISC-V 架构中一共定义了 4 种特权级：

| 特权级 | 编码 | 名称                    | 描述                                                         |
| ------ | ---- | ----------------------- | ------------------------------------------------------------ |
| 0      | 00   | 用户/应用模式 (U)       | 用于运行普通的用户应用程序。在这个模式下，应用程序不能执行特权指令，也不能直接访问硬件资源。 |
| 1      | 01   | 监督模式 (S)            | 通常用于运行操作系统内核。在这个模式下，操作系统可以执行特权指令来管理进程、内存和其他系统资源，但是它不能直接访问所有的硬件资源。 |
| 2      | 10   | 虚拟监督模式 (H)        | 用于运行虚拟化管理程序（Hypervisor），它可以在物理硬件上管理多个虚拟机监视器（VMM）。Hypervisor模式可以执行一些特定的管理操作，但不是所有的机器级指令都是可用的。 |
| 3      | 11   | 机器模式 (M)            | 用于运行固件和操作系统内核。机器模式可以执行所有的指令，并且可以直接访问所有的硬件资源。通常，机器模式下的代码负责硬件管理和启动时的引导。 |

其中，级别的数值越大，特权级越高，掌控硬件的能力越强。从表中可以看出， M 模式处在最高的特权级，而 U 模式处于最低的特权级。在CPU硬件层面，除了M模式必须存在外，其它模式可以不存在。

从特权级架构的角度，去分析支持应用程序运行的执行环境栈，如下图所示：

![特权级](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/PrivilegeStack.png)

其中，白色块表示一层执行环境，黑色块表示相邻两层执行环境之间的接口。这张图片给出了能够支持运行 Unix 这类复杂系统的软件栈。其中操作系统内核代码运行在 S 模式上；应用程序运行在 U 模式上。运行在 M 模式上的软件被称为 监督模式执行环境 (SEE, Supervisor Execution Environment)，如在操作系统运行前负责加载操作系统的 Bootloader – RustSBI。站在运行在 S 模式上的软件视角来看，它的下面也需要一层执行环境支撑，因此被命名为 SEE，它需要在相比 S 模式更高的特权级下运行，一般情况下 SEE 在 M 模式上运行。

### 文件系统
在操作系统的管理下，应用程序不用理解持久存储设备的硬件细节，而只需对 文件 这种持久存储数据的抽象进行读写就可以了，由操作系统中的文件系统和存储设备驱动程序一起来完成繁琐的持久存储设备的管理与读写。

![文件系统](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202024-05-20%20211446.png)

### 移植FATFS
之前移植FATFS文件系统到FeatOS（其实就是照着rCore写的，改了一点）中时，学习FATFS结构打的草稿。

![FATFS](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/FATFS.jpg)

最后移植成功后，能够读取并运行FAT32文件系统镜像中的elf文件。



## 3 总结
这次总算是圆满完成第二阶段了，同时也取得了不错的成绩。文件系统和并发让我印象深刻，打算后面完成第三阶段后再回来详细的搞搞ch6后面的东西。

![成绩](https://osfantasyphoto.oss-cn-chengdu.aliyuncs.com/blog/os-lab/stage1/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE%202024-05-20%20214215.png)

感激社区提供了这样一个学习平台，它为我打开了一扇探索操作系统奥秘的大门。希望后续的学习我还能够坚持下去吧！
