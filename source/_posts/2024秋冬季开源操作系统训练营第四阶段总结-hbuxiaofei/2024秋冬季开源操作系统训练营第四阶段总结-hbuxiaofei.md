---
title: 2024秋冬季开源操作系统训练营第四阶段总结-hbuxiaofei
date: 2024-12-21 22:00:35
tags:
---


## x86 架构 hypervisor SeaBIOS 引导与 Linux 启动实现

### 1. seabios 工作流程
```
(1) POST( Power On Self Test)：上电自检，BIOS 对计算机硬件（CPU、主板、内存等）的检测。
(2) POST 之后的初始化与启动相关硬件（磁盘、键盘控制器等）。
(3) 为 OS 创建一些参数，如 ACPI、E820 表等。
(4) 选择引导设备，从设备中加载 BootLoader，进而启动操作系统。
```

### 2. qemu 加载seabios过程
```
(1) qemu加载 seabios 在地址的 4G 最顶端的 LOW_MMIO 区，以及低 1M 区域各有一份。
(2) cpu 的第一条取指地址为 0xFFFFFFF0，该地址指向贴近 4G 的 BIOS 的最后 16 个字节，这也是 BIOS 的第一条指令。
(3) BIOS 最后 16 个字节处，是一个长跳转指令，目的就是换到低 1M 段空间去执行 entry_post ( ORG 0xe05b )
```

### 3. kbuild 使用方法
```
参考: https://github.com/Starry-OS/Starry

# To download the tool
$ cargo install kbuild
$ mkdir crates
$ kbuild patch add axstarry
$ kbuild patch remove axstarry
$ kbuild patch list
```

### 4. seabios 编译方法
```
cat > .config << EOF
# for qemu machine types 2.0 + newer
CONFIG_QEMU=y
CONFIG_ROM_SIZE=256
CONFIG_ATA_DMA=n

CONFIG_XEN=n

CONFIG_DEBUG_LEVEL=9
CONFIG_DEBUG_SERIAL=y
EOF
echo "CONFIG_DEBUG_LEVEL=9" >> .config

make PYTHON=python3 oldnoconfig
make

```

### 5. seabios 反汇编

```
objdump -D -b binary -m i8086 bios.bin
objdump -D -b binary -m i8086 romlayout.o

-M intel : 指定intel格式
```

### 6. kvm 中所有 port IO
所谓端口Port IO, x86上使用in out指令进行访问, 和内存的地址空间完全隔离.(ARM上没有PIO) Guest以Linux为例: `cat /proc/ioports`查看当前OS的所有的ioports :

```
  0000-0cf7 : PCI Bus 0000:00
  0000-001f : dma1
  0020-0021 : pic1
  0040-0043 : timer0
  0050-0053 : timer1
  0060-0060 : keyboard
  0064-0064 : keyboard
  0070-0077 : rtc0
  0080-008f : dma page reg
  00a0-00a1 : pic2
  00c0-00df : dma2
  00f0-00ff : fpu
  03c0-03df : vga+
  03f8-03ff : serial
  0510-051b : QEMU0002:00
    0510-051b : fw_cfg_io
  0600-067f : 0000:00:1f.0
    0600-0603 : ACPI PM1a_EVT_BLK
    0604-0605 : ACPI PM1a_CNT_BLK
    0608-060b : ACPI PM_TMR
    0620-062f : ACPI GPE0_BLK
    0630-0633 : iTCO_wdt.0.auto
      0630-0633 : iTCO_wdt
    0660-067f : iTCO_wdt.0.auto
      0660-067f : iTCO_wdt
  0700-073f : 0000:00:1f.3
    0700-073f : i801_smbus
0cf8-0cff : PCI conf1
0d00-ffff : PCI Bus 0000:00
  1000-1fff : PCI Bus 0000:01
  2000-2fff : PCI Bus 0000:02
  3000-3fff : PCI Bus 0000:03
  4000-4fff : PCI Bus 0000:04
  5000-5fff : PCI Bus 0000:05
  6000-6fff : PCI Bus 0000:06
  7000-7fff : PCI Bus 0000:07
  c040-c05f : 0000:00:1f.2
    c040-c05f : ahci

```

### 7. 项目实现总结

项目刚开始, 我把seabios当作 kernel，写了个简单的 bios 来引导 seabios ，seabios成功运行
```asm
.section .text
.code16
.global entry16
entry16:
    cli
    cld

        xor     ax, ax
        mov     ds, ax
        mov     es, ax

        ljmp    0xf000, 0xe05b
```

后面通过学习vmcs的使用方法，增加了CS寄存器的设置后，seabios 可以自启动成功。
```rust
VmcsGuestNW::RIP.write(entry.as_usize() & 0xffff)?;
VmcsGuest16::CS_SELECTOR.write(((entry.as_usize() >> 4) & 0xf000) as u16)?;
// On Intel requires 'base' to be 'selector * 16' in real mode.
VmcsGuestNW::CS_BASE.write(entry.as_usize() & 0xf0000)?;
```
对应的linux.tmol修改为
```toml
cpu_num = 1
phys_cpu_sets = [1]
entry_point = 0xf_e05b
bios_path = "bios-256k.bin"
bios_load_addr = 0xc_0000
kernel_path = "arceos-x86_64.bin"
kernel_load_addr = 0x100_0000
# ramdisk_path = ""
# ramdisk_load_addr = 0
# disk_path = "disk.img"
# Memory regions with format (`base_paddr`, `size`, `flags`).
memory_regions = [
    [0x0000_0000, 0x1_0000, 0x13],    # IO Port		64K	0b10011
    [0x0001_0000, 0x400_0000, 0x7],   # Low RAM		64M	0b111
    [0xfec0_0000, 0x1000, 0x17],      # IO APIC		4K	0b10111
    [0xfee0_0000, 0x1000, 0x17],      # Local APIC	4K	0b10111
    [0xfed0_0000, 0x1000, 0x17],      # HPET 		4K  0b10111
]
# Emu_devices
# Name Base-Ipa Ipa_len Alloc-Irq Emu-Type EmuConfig
emu_devices = [
]
```

Seabios 加载内核流程，seabios加载内核是通过 fw_cfg 的 file 接口，读取 multiboo.bin 当作 rom 来加载的，这个 multiboo.bin是linux内核封装过的带有 0x55aa 标记的可以引导的 rom，seabios读取到 rom后，加载到内存中然后执行。整理需要实现内容如下(“对号” 为截至此笔记已完成的):

- [x] 1. seabios第一条指令地址为: 0xf000:0xe05b, 支持设置primary vcpu第一条指令地址 entry_point.


    ```
    1. 目前实模式下还不支设置超过0xffff的地址
    2. 考虑设置代码段 CS 寄存器
    ```

- [x] 2. 设置虚拟化需要截获的io端口

    ```
    有些端口需要进行截获, 否则会透传到宿主机, 获取宿主机的信息, 例如pci信息, 内存大小信息等
    ```

- [ ] 3. dma 实现支持

    ```
    很多数据的传输需要通过 dma 传输
    ```


- [ ] 4. 实现fw_cfg设备模拟


    - [x] fw_cfg 实现 pio, 设备地址 [0x510, 0x511]
    ```
    告诉seabios, 虚拟化环境为 “QEMU”

    ```

    - [ ] fw_cfg 实现 dma, 设备地址 [0x514]
    ```
    用于传输数据, 例如内核data数据等
    ```

- [x] 5. 实现rtc设备模拟, 设备地址 [0x70, 0x71]


    ```
    在虚拟化环境中, seabios 通过 rtc 几个保留的寄存器获取内存大小信息
    ```

- [ ] 6. multiboot 实现

    ```
    seabios通过内核启动是通过multiboot协议启动的, 需要将内核文件进行重新封装
    ```


- [ ] 其他 ...


**修改链接如下:**

https://github.com/hbuxiaofei/arceos-umhv/tree/support-seabios

https://github.com/hbuxiaofei/axvcpu/tree/support-seabios

https://github.com/hbuxiaofei/x86_vcpu/tree/support-seabios

https://github.com/hbuxiaofei/axvm/tree/support-seabios

https://github.com/hbuxiaofei/axdevice/tree/support-seabios


**运行日志：**
```
[  0.307806 0:2 axvm::vm:230] Booting VM[1]
[  0.308076 0:2 arceos_vmm::vmm:40] VM[1] boot success
[  0.308390 0:2 axtask::run_queue:393] task block: Task(2, "main")
[  0.308757 0:3 axtask::task:471] task drop: Task(4, "")
[  0.309079 0:3 axtask::run_queue:393] task block: Task(3, "gc")
[  0.309436 0:5 arceos_vmm::vmm::vcpus:240] VM[1] Vcpu[0] waiting for running
[  0.309852 0:5 arceos_vmm::vmm::vcpus:243] VM[1] Vcpu[0] running...
[  0.310227 0:5 x86_vcpu::vmx::vcpu:118] VmxVcpu bind to current processor vmcs @ PA:0x5b2000
[  0.310751 0:5 axvm::vm:258] >>>>> exit_reason  IoWrite {
    port: 0x70,
    width: Byte,
    data: 0x8f,
}

[  0.311332 0:5 axvm::vm:289] IoWrite: 0x70 Byte 0x8f
[  0.311646 0:5 axdevice::device:96] emu: GPA:0x70..GPA:0x72 handler write port:GPA:0x70 width:1 val:0x8f
[  0.312180 0:5 axdevice::rtc:54] Rtc select 0xf

[  0.312482 0:5 axvm::vm:258] >>>>> exit_reason  IoRead {
    port: 0x71,
    width: Byte,
}

[  0.312984 0:5 axvm::vm:278] IoRead: 0x71 Byte
[  0.313268 0:5 axdevice::device:79] emu: GPA:0x70..GPA:0x72 handler read port:GPA:0x71 width:1
[  0.313758 0:5 axdevice::rtc:81] Rtc read addr: GPA:0x71 GPA:0x71

[  0.314130 0:5 axdevice::rtc:62] Rtc get index: 0xf

[  0.314454 0:5 axvm::vm:258] >>>>> exit_reason  Nothing

[  0.314787 0:5 x86_vcpu::vmx::vcpu:131] VmxVcpu unbind from current processor vmcs @ PA:0x5b2000
[  0.315285 0:5 x86_vcpu::vmx::vcpu:118] VmxVcpu bind to current processor vmcs @ PA:0x5b2000
SeaBIOS (version 1.16.0-20241104_115553-centos83-dev)
BUILD: gcc: (GCC) 8.5.0 20210514 (Red Hat 8.5.0-4) binutils: version 2.30-108.el8_5.1
enabling shadow ram
[  0.316631 0:5 axvm::vm:258] >>>>> exit_reason  IoWrite {
    port: 0xcf8,
    width: Dword,
    data: 0x80000000,
}

[  0.317243 0:5 axvm::vm:289] IoWrite: 0xcf8 Dword 0x80000000
[  0.317586 0:5 axdevice::device:96] emu: GPA:0xcf8..GPA:0xd00 handler write port:GPA:0xcf8 width:4 val:0x80000000
[  0.318159 0:5 axdevice::pci:210] >>> axdevice pci write GPA:0xcf8 0x80000000...

[  0.318592 0:5 axdevice::pci:87] >>> set address 0x0 : device:0x0 : 0x0 : 0x0

[  0.319020 0:5 axvm::vm:258] >>>>> exit_reason  IoRead {
    port: 0xcfc,
    width: Word,
}
read QEMU_CFG_SIGNATURE 85(U)
Found QEMU fw_cfg
>>> qemu_cfg_read_entry start ...
>>> cfg read qemu_cfg_read over
>>> qemu_cfg_read_entry over ...
QEMU fw_cfg: 956659(0xe98f3) 0x2
QEMU fw_cfg DMA interface supported
>>> qemu_early_e820 call qemu_cfg_read_entry, port:0x19
>>> qemu_cfg_read_entry start ...
>>> cfg read qemu_cfg_dma_transfer 0x6f80 4
>>> dma outl: 0x518 0x806f000000000000
[  0.508528 0:5 axvm::vm:258] >>>>> exit_reason  IoWrite {
    port: 0x518,
    width: Dword,
    data: 0x206f0000,
}

[  0.509263 0:5 axvm::vm:289] IoWrite: 0x518 Dword 0x206f0000
[  0.509671 0:5 axdevice::device:96] emu: GPA:0x510..GPA:0x522 handler write port:GPA:0x518 width:4 val:0x206f0000
[  0.510356 0:5 axdevice::fwcfg:238] >>> do_write GPA:0x518 4 0x206f0000

[  0.510837 0:5 axdevice::fwcfg:226] dma_write: GPA:0x518 0x206f0000

>>> dma outl over: 0x518 0x806f000000000000
QEMU: Terminated
```

---

**参考文档:**

[SeaBIOS实现简单分析](https://www.cnblogs.com/gnuemacs/p/14287120.html)

[浅度剖析 SeaBIOS 之 QEMU 初始化](https://zhuanlan.zhihu.com/p/678576761)

<<Qemu/kvm源码解析与应用>> - 李强
