---
title: <2023秋冬rCore训练营第二阶段总结-huahuadeliaoliao>
date: 2023-11-06 15:08:21
tags:
    - author:<huahuadeliaoliao>
---

# 关于使用Apple silicon mac完成rcore实验的方法

## 1.选择docker会比vmware更好
  
    如果使用8g内存的m1 mac来做实验的话推荐使用docker来做，相较于vmware来说docker的内存占用会更低一些（8g内存开个虚拟机和vscode挂几个网页基本上就压力就变黄了，要是再挂着qq、微信可能会直接变红），另外我的vmwaretools安装了也无法正常使用，我想在虚拟机内使用宿主机代理折腾了几天也没能实现，但是在docker上就很容易成功，还有就是arm64linux的软件支持比较少（科学上网方面），docker上的环境配置见 https://docs.qq.com/doc/DWW1GZ3FQekx5dm9T 第24个

## 2.在mac上直接配置环境（不建议使用）

    官方的文档里说可以直接在m1 mac上跑rcore，我成功跑通了，首先需要下载和编译riscvtools，
    下载得科学上网并且非常耗费流量（我使用镜像失败了），编译这个过程得花费一到两个小时，我试过使用他们编译好的但是无法运行，具体步骤可以参考 https://cloud.tencent.com/developer/article/1939023  然后就是下载依赖 
    brew install gawk gnu-sed gmp mpfr libmpc isl zlib expat
    以及qemu建议选择qemu7.0.0（老版本qemu需要补丁 https://github.com/BASARANOMO/xv6-labs-2020/issues/1 ）
    接下来具体步骤可以参考实验书以及
    https://risc-v-getting-started-guide.readthedocs.io/en/latest/linux-qemu.html#prerequisites
    make这步由于mac上的make只有老版本所以应该得使用gmake
    make -j$(nproc)   //这步需要先安装nproc，如果这步使用make报错了的话使用gmake
    接下来就可以克隆仓库运行了，跑ch1没有任何问题但是我运行后面几个实验的时候经常会遇到报错，网上也没有解决办法，所以不建议使用这个方法

# ch3

    第一个实验要实现sys_task_info系统调用，首先在TaskControlBlock中添加syscall_times和start_time，同时在new中更新添加，接下来要实现系统调用次数信息的更新，我在内核的调度函数 run_next_task 中增加了一个简单的判断逻辑，以确定是否是进程的第一次被调度，并在需要时初始化 start_time。

# ch4

    第二个实验需要重写 sys_get_time 和 sys_task_info, sys_get_time 的主要功能是获取当前时间并填充传递给系统调用的 TimeVal 结构。首先获取时间戳，然后将其转化为秒和微秒，填充到 TimeVal 结构中，最后将数据复制到用户空间的 ts 指针所指向的内存区域。sys_task_info 用于获取当前任务的信息，包括任务状态、系统调用次数和任务运行时间。首先通过相关函数获取这些信息，然后填充到 TaskInfo 结构中，最后将数据复制到用户空间的 ti 指针所指向的内存区域。

# ch5

    第三个实验要实现 spawn 系统调用，首先，获取当前任务的控制块 task。使用 translated_str 函数将传递的路径 path 转化为字符串。检查是否可以找到与给定路径匹配的 ELF 数据，如果找到了 ELF 数据，就继续进行后续步骤，否则返回 -1。
    用 ELF 数据创建新的内存集合，为新进程分配一个进程 ID（PID）和一个内核堆栈。接下来创建一个新的任务控制块，该控制块包含了新进程的信息，如 PID、内核堆栈、内存集合等。将新任务控制块添加到当前任务的子任务列表中，表示当前任务是新任务的父任务。最后，将新任务添加到任务管理器中，并返回新任务的 PID。关于stride调度算法实现我参考了
    https://hangx-ma.github.io/2023/07/07/rcore-note-ch5.html