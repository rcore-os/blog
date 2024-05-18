---
title: '2024春夏季OS训练营:如何快速搭建基于docker和vscode的开发和调试环境-xuejianxinokok.md'
date: 2024-05-17 09:23:01
tags:
---



一阶段学习参考



- [转:Learn Rust the Dangerous Way-系列文章翻译-总述 - 掘金](https://juejin.cn/post/7358742048134365221)，这系列文章总结了rust改写c语言 ，非常经典

- [*如何在rust 中实现 带有循环引用的数据结构 - 掘金](https://juejin.cn/post/7359110982227640374)



----



在学习os开发的时候如何使我们能够愉快的开始学习，而不在配置环境折腾的时间太长，以下是我的实践。

我的系统是windows11,上边安装了dockerdesktop.

## 1. docker 容器

```shell
# 检出源码

git clone git://github.com/rcore-os/rCore-Tutorial-v3

# 切换到源码目录，我把源码检出到 本机以下目录

cd  D:\work20220906\gitee\rusttest\rCore-Tutorial-v3

# 制作 docker 镜像
# 这里我们把镜像的名称设置为rcore
docker build -t rcore  --target build .

# 运行docker dev container
# 为了能够在容器内看到源码，需要把包含源码的目录 隐射到容器内部
# 我为了方便 把源码的上层目录隐射到了容器内部 /mnt
docker run --name os1 --hostname os1  -v D:/work20220906/gitee/rusttest/:/mnt -w /mnt  -d rcore  sleep infinity 
# docker  rm -f os1 


# 在cmd 中， 进入容器ssh 
docker exec -it os1 /bin/bash 

# 测试运行
# 切换到目录
cd /mnt/rCore-Tutorial-v3/os
运行
make run  
```

docker 镜像

{% asset_img 2024-05-17-09-40-49-image.png 2024-05-17-09-40-49-image %}

开发容器

{% asset_img 2024-05-17-09-41-14-image.png 2024-05-17-09-41-14-image %}

## 2. dev container 开发环境

### 2.1 安装vscode 及其插件

为了支持docker dev container 需要安装以下插件

{% asset_img 2024-05-17-09-42-12-image.png 2024-05-17-09-42-12-image %}

点击以下红色标识位置连接到dev container

{% asset_img 2024-05-17-09-46-03-image.png 2024-05-17-09-46-03-image.png %}

然后打开/mnt/ 目录下的项目文件夹

{% asset_img 2024-05-17-09-47-48-image.png 2024-05-17-09-47-48-image.png %}

## 2.2 安装调试插件

{% asset_img 2024-05-17-09-49-01-image.png 2024-05-17-09-49-01-image.png %}

## 3. 在vscode 中支持远程调试

### 3.1 在容器os1 内编译 gdb

```shell
```shell
#1. 进入docker 
docker exec -it os1 /bin/bash
#2. 安装终端复用工具
apt install tmux
apt-get install libncurses5-dev texinfo libreadline-dev
# 在 configure  发现少了2个库，补上
apt-get install libgmp-dev libmpfr-dev
# 缺少python-dev，没有也可
apt install python3.8-dev

# 好像docker 环境已经预装了python3.8
#apt-get install python3
#which python3 

#ll $(which python3)  

# 建立符号连接 到/usr/bin/python
#ln -s  /usr/bin/python3.8*  /usr/bin/python
#root@os1:/usr/bin# which python
#/usr/bin/python

#whereis python3

#python3 --version
#Python 3.8.10

#4. 下载gdb
wget https://mirrors.tuna.tsinghua.edu.cn/gnu/gdb/gdb-14.2.tar.xz
#解压
tar -xvf gdb-14.2.tar.xz
# 进入目录
cd gdb-
14.2

#查看当前目录 pwd
/mnt/gdb-14.2
# 创建编译目录
mkdir build-riscv64

cd build-riscv64



#5. 配置编译选项，可以不配置with-python
../configure --prefix=/mnt/gdb-14.2/build-riscv64 --with-python=/usr/bin/python3 --target=riscv64-unknown-elf --enable-tui=yes

# 6.编译
make -j$(nproc)
# 7.安装
make install

# 8. 编译好的 GDB 存放在 build-riscv64/bin/ 目录下，你可以只保留这个目录，然后添加这个目录到环境变量。
# 确认 GDB 可以运行
./bin/riscv64-unknown-elf-gdb --version


root@os1:/mnt/gdb-14.2/build-riscv64# ./bin/riscv64-unknown-elf-gdb --version
GNU gdb (GDB) 14.2
Copyright (C) 2023 Free Software Foundation, Inc.
License GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.
root@os1:/mnt/gdb-14.2/build-riscv64# ll ./bin/
total 238428
drwxr-xr-x 1 root root      4096 May 13 03:10 ./
drwxr-xr-x 1 root root      4096 May 13 03:10 ../
-rwxr-xr-x 1 root root 232530576 May 13 03:10 riscv64-unknown-elf-gdb*
-rwxr-xr-x 1 root root      4627 May 13 03:10 riscv64-unknown-elf-gdb-add-index*
-rwxr-xr-x 1 root root  11605272 May 13 03:10 riscv64-unknown-elf-run*




# 我们直接拷贝到/usr/local/bin 目录，这样直接可以全局使用
ll /usr/local/bin

cp /mnt/gdb-14.2/build-riscv64/bin/*  /usr/local/bin


# 9. 安装 gdb-dashboard：仅仅是下载一个 python 文件到 ~/.gdbinit 来做 gdb 的启动拓展
wget -P ~ https://github.com/cyrus-and/gdb-dashboard/raw/master/.gdbinit
# 以下是 gdbinit 文件的存放目录
root@os1:~# pwd
/root
root@os1:~# ll -la
-rw-r--r-- 1 root root 93928 May 13 03:15 .gdbinit
```

### 3.2 使编译的os文件支持调试信息

**以rcore  ch3 为例**

```shell
#1. os/Makefile 文件中 修改和添加以下内容
# MODE := release  保证是debug编译 会保留符号信息
MODE := debug
# 包装gdb 命令否则rustc源码无法对应
GDB_PATH := riscv64-unknown-elf-gdb
gdb := RUST_GDB=$(GDB_PATH) rust-gdb

debug: build
    @tmux new-session -d \
        "qemu-system-riscv64 -machine virt -nographic -bios $(BOOTLOADER) -device loader,file=$(KERNEL_BIN),addr=$(KERNEL_ENTRY_PA) -s -S" && \
        tmux split-window -h "$(gdb) -ex 'file $(KERNEL_ELF)' -ex 'set arch riscv:rv64' -ex 'target remote localhost:1234'" && \
        tmux -2 attach-session -d

#2. user/Makefile
# MODE := release  保证编译debug
MODE := debug


#3. user/build.py

#mode = os.getenv("MODE", default = "release")
mode = os.getenv("MODE", default = "debug")

# 4.user/src/linker.ld 文件中
/DISCARD/ : {
        *(.eh_frame)
      /*  *(.debug*) */  注释掉这行，不删除调试信息
```

用以下命令确定os文件支持调试

```shell
root@os1:/mnt/2024s-rcore-xuejianxinokok/os/target/riscv64gc-unknown-none-elf/debug# file os
os: ELF 64-bit LSB executable, UCB RISC-V, version 1 (SYSV), 
statically linked, 

with debug_info, not stripped   <<<<<<< 注意是这行



# 或者直接读取section 信息，发现有debug_info  这些section
root@os1:/mnt/2024s-rcore-xuejianxinokok/os/target/riscv64gc-unknown-none-elf/debug# readelf -SW os
There are 18 section headers, starting at offset 0x2952a8:

Section Headers:
  [Nr] Name              Type            Address          Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            0000000000000000 000000 000000 00      0   0  0
  [ 1] .text             PROGBITS        0000000080200000 001000 00a340 00  AX  0   0  4
  [ 2] .rodata           PROGBITS        000000008020b000 00c000 0334ab 00  AM  0   0 4096
  [ 3] .data             PROGBITS        000000008023f000 040000 028920 00  WA  0   0  8
  [ 4] .bss              NOBITS          0000000080268000 068920 038660 00  WA  0   0  8
  [ 5] .debug_abbrev     PROGBITS        0000000000000000 068920 006a82 00      0   0  1
  [ 6] .debug_info       PROGBITS        0000000000000000 06f3a2 073718 00      0   0  1
  [ 7] .debug_aranges    PROGBITS        0000000000000000 0e2aba 0061b0 00      0   0  1
  [ 8] .debug_str        PROGBITS        0000000000000000 0e8c6a 08d4ab 01  MS  0   0  1
  [ 9] .comment          PROGBITS        0000000000000000 176115 000048 01  MS  0   0  1
  [10] .riscv.attributes RISCV_ATTRIBUTES 0000000000000000 17615d 00003e 00      0   0  1
  [11] .debug_frame      PROGBITS        0000000000000000 1761a0 007f08 00      0   0  8
  [12] .debug_line       PROGBITS        0000000000000000 17e0a8 040627 00      0   0  1
  [13] .debug_ranges     PROGBITS        0000000000000000 1be6cf 033b00 00      0   0  1
  [14] .debug_loc        PROGBITS        0000000000000000 1f21cf 000b72 00      0   0  1
  [15] .symtab           SYMTAB          0000000000000000 1f2d48 096048 18     17 25465  8
  [16] .shstrtab         STRTAB          0000000000000000 288d90 0000b5 00      0   0  1
  [17] .strtab           STRTAB          0000000000000000 288e45 00c462 00      0   0  1
Key to Flags:
  W (write), A (alloc), X (execute), M (merge), S (strings), I (info),
  L (link order), O (extra OS processing required), G (group), T (TLS),
  C (compressed), x (unknown), o (OS specific), E (exclude),
  p (processor specific)
```

这时我们就可以在 容器内的命令行进行调试了，但这样还是不太方便

进入gbd 后

**先回车后** ,然后再输入 `b rust_main`

```
b rust_main 
Breakpoint 1 at 0x8020618a: file src/main.rs, line 98.
```

再输入 c

{% asset_img 2024-05-14-14-13-18-image.png 2024-05-14-14-13-18-image.png %}

{% asset_img 2024-05-14-14-20-57-image.png 2024-05-14-14-20-57-image.png %}

### 3.3 配置vscode 调试

虽然我们就可以在命令行进行调试了，但这样还是不太方便，我们接着配置vscode中的调试

按F5 启动调试添加 .vscode/launch.json

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "gdb Remote Launch",
            "type": "cppdbg",
            "request": "launch",
            "program": "${workspaceRoot}/os/target/riscv64gc-unknown-none-elf/debug/os",
            "args": [],
            "stopAtEntry": true,
            "environment": [],
            "externalConsole": false,
            "MIMode": "gdb",
            "miDebuggerPath": "riscv64-unknown-elf-gdb",
            "miDebuggerServerAddress": "localhost:1234",
            "miDebuggerArgs": "gdb",

            "setupCommands": [
                {
                  "text": "set arch riscv:rv64",
                  "ignoreFailures": true
                },
                {
                    "description": "Enable pretty-printing for gdb",
                    "text": "-enable-pretty-printing",
                    "ignoreFailures": true
                }
            ],
            "cwd": "${workspaceFolder}",
        }
    ]
}
```

**在另一个终端窗口启动 make gdbserver**

在vscode 启动调试

![](assets/2024-05-15-13-49-42-image.png)

{% asset_img 2024-05-15-13-49-42-image.png 2024-05-15-13-49-42-image.png %}

{% asset_img 2024-05-15-13-59-17-image.png 2024-05-15-13-59-17-image.png %}

{% asset_img 2024-05-15-14-00-13-image.png 2024-05-15-14-00-13-image.png %}

{% asset_img 2024-05-15-14-02-58-image.png 2024-05-15-14-02-58-image %}

为了每次按F5 时能够自动打开gbdserver

需要在 .vscode/launch.json配置一个preLaunchTask

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "gdb Remote Launch",
            "type": "cppdbg",
            "request": "launch",
            "program": "${workspaceRoot}/os/target/riscv64gc-unknown-none-elf/debug/os",
            "args": [],
            // 在入口处停止
            "stopAtEntry": true,
            "environment": [],
            "externalConsole": true,
            // 调试会话开始前执行的任务，一般为编译程序。与tasks.json的label相对应
            // 参考 https://blog.csdn.net/BlizCp/article/details/111054747
            "preLaunchTask": "startGdbserverTask",
            "MIMode": "gdb",
            //调试器路径，Windows下后缀不能省略，Linux下则去掉
            "miDebuggerPath": "riscv64-unknown-elf-gdb",
            "miDebuggerServerAddress": "localhost:1234",
            "miDebuggerArgs": "gdb",

            "setupCommands": [
                {
                  "text": "set arch riscv:rv64",
                  "ignoreFailures": true
                },
                {
                    "description": "Enable pretty-printing for gdb",
                    "text": "-enable-pretty-printing",
                    "ignoreFailures": true
                }
            ],
            "cwd": "${workspaceFolder}",
        }
    ]
}
```

在.vscode/tasks.json

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "type": "shell",
            "label": "startGdbserverTask",
            "command": "nohup",
            "args": [
                "make",
                "gdbserver",
                "-w",

            ],
            "options": {
                "cwd": "${workspaceRoot}/os"
            },
            "hide": true
        }
    ]

}
```

为了能使 gdbserver在后台运行，os/Makefile,在命令结尾-s -S 后边添加了 `&` ,否则阻塞client启动

```shell
gdbserver: build
    @qemu-system-riscv64 -machine virt -nographic -bios $(BOOTLOADER) -device loader,file=$(KERNEL_BIN),addr=$(KERNEL_ENTRY_PA) -s -S &
```

有时候gdbserver 没有被杀死导致启动不了,需要找到进程然后手动kill

```shell
root@os1:/mnt/2024s-rcore-xuejianxinokok/os# lsof -i:1234
COMMAND    PID USER   FD   TYPE  DEVICE SIZE/OFF NODE NAME
qemu-syst 5049 root    9u  IPv4 8134403      0t0  TCP *:1234 (LISTEN)
qemu-syst 5049 root   10u  IPv6 8134404      0t0  TCP *:1234 (LISTEN)
```

这样就可以愉快的调试了。

路漫漫...

感谢训练营的老师们！！！

---

## 4.参考文档：

- [【笔记】rCore (RISC-V)：GDB 使用记录 | 苦瓜小仔](https://zjp-cn.github.io/posts/rcore-gdb/)

- [rcore GDB 调试方法* · GitBook](https://rcore-os.cn/rCore-Tutorial-deploy/docs/pre-lab/gdb.html)

- [主要参考:文档vscode + gdb +gdbserver 远程调试Pg源码_vscode gdbserver-CSDN博客](https://blog.csdn.net/shipeng1022/article/details/134397319)

- [VSCode配置luanch和task_配置 prelaunchtask 阻塞-CSDN博客](https://blog.csdn.net/BlizCp/article/details/111054747)

- [附录 B：常见工具的使用方法 - rCore-Tutorial-Book-v3 3.6.0-alpha.1 文档](https://rcore-os.cn/rCore-Tutorial-Book-v3/appendix-b/index.html)

- [VsCode + gdb + gdbserver远程调试C++程序_vscode gdbserver-CSDN博客](https://blog.csdn.net/u014552102/article/details/122793256)

- [Debugging in Visual Studio Code](https://code.visualstudio.com/docs/editor/debugging)
