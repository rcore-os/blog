# qemu 模拟 igb设备

## Make方式

在linux系统下可使用make方式运行，需修改arceos/scripts/make目录下qemu.mk文件，更改 Qemu 模拟网卡为 igb。

将`qemu_args-$(NET)`的参数，由`-device virtio-net-$(vdev-suffix),netdev=net0`修改为`-device igb,netdev=net0`。

在arceos目录下运行make命令：

```shell
make A=examples/httpclient PLATFORM=aarch64-qemu-virt LOG=debug SMP=2 NET=y NET_DEV=user run
```

最终生成的运行命令:
```shell
qemu-system-aarch64 -m 128M -smp 2 -cpu cortex-a72 -machine virt -kernel examples/httpclient/httpclient_aarch64-qemu-virt.bin -device virtio-net-pci,netdev=net0 -netdev user,id=net0,hostfwd=tcp::5555-:5555,hostfwd=udp::5555-:5555 -nographic
```

这里其实我们可以自己进行一个理解,先从`qemu`的命令开始:
1. `-m` 设置分配的内存
2. `-smp` 设置对称多处理（SMP）配置,这里指定的是创建一个具有两个 CPU 核心的虚拟机
3. `-cpu` 指定要模拟的 CPU 类型,在这里是 Cortex-A72
4. `-machine` 选择平台,这里使用 `virt` 类型的机器模型,这是一个通用的,不与任何特定硬件绑定的虚拟平台
5. `-kernel` 指定内核映像文件,这个文件是在虚拟机启动时加载的程序或操作系统内核
6. `-device` 添加一个 `PCI` 设备到虚拟机中,这个设备是一个`VirtIO` 网络适配器,并且它连接到了 `ID` 为 `net0` 的网络后端
7. `-netdev` 定义了一个用户模式网络后端，其 `ID` 是 `net0`。同时设置了主机端口转发规则，将主机的 `TCP` 和 `UDP` 的 `5555` 端口转发到虚拟机的相同端口
8. `-nographic` 禁用图形输出

那么我们可以得到如下的问题.

## 如何编译得来`.bin`文件?

看log的时候很不仔细,其实在log里是有的:

```shell
cargo -C examples/httpclient build -Z unstable-options --target aarch64-unknown-none-softfloat --target-dir /home/winddevil/workspace/arceos/target --release  --features "axstd/log-level-debug axstd/smp"
```

然后我们直接运行这个编译过程是发现会报错的,这是什么原因呢?输出log是:

```shell
warning: `/home/winddevil/.cargo/config` is deprecated in favor of `config.toml`
note: if you need to support cargo 1.38 or earlier, you can symlink `config` to `config.toml`
warning: `/home/winddevil/.cargo/config` is deprecated in favor of `config.toml`
note: if you need to support cargo 1.38 or earlier, you can symlink `config` to `config.toml`
warning: `/home/winddevil/.cargo/config` is deprecated in favor of `config.toml`
note: if you need to support cargo 1.38 or earlier, you can symlink `config` to `config.toml`
warning: `/home/winddevil/.cargo/config` is deprecated in favor of `config.toml`
note: if you need to support cargo 1.38 or earlier, you can symlink `config` to `config.toml`
   Compiling log v0.4.21
   Compiling cfg-if v1.0.0
   Compiling tock-registers v0.8.1
   Compiling bitflags v2.6.0
   Compiling axerrno v0.1.0
   Compiling byteorder v1.4.3
   Compiling const-default v1.0.0
   Compiling memory_addr v0.3.1
   Compiling bit_field v0.10.2
   Compiling percpu v0.1.3
   Compiling lock_api v0.4.10
   Compiling lazyinit v0.2.1
   Compiling axconfig v0.1.0 (/home/winddevil/workspace/arceos/modules/axconfig)
   Compiling int_ratio v0.1.0
   Compiling static_assertions v1.1.0
   Compiling linkme v0.3.27
   Compiling scopeguard v1.2.0
   Compiling handler_table v0.1.1
   Compiling kernel_guard v0.1.1
   Compiling axdriver_base v0.1.0 (https://github.com/arceos-org/axdriver_crates.git?tag=v0.1.0#78686a7e)
   Compiling aarch64-cpu v9.4.0
   Compiling rlsf v0.2.1
   Compiling dw_apb_uart v0.1.0
   Compiling arm_gicv2 v0.1.0
   Compiling arm_pl011 v0.1.0
   Compiling bitmap-allocator v0.1.0
   Compiling heapless v0.7.16
   Compiling kspin v0.1.0
   Compiling zerocopy v0.7.35
   Compiling hash32 v0.2.1
   Compiling stable_deref_trait v1.2.0
   Compiling smoltcp v0.10.0 (https://github.com/rcore-os/smoltcp.git?rev=2ade274#2ade2747)
   Compiling axdriver v0.1.0 (/home/winddevil/workspace/arceos/modules/axdriver)
   Compiling num-traits v0.2.16
   Compiling managed v0.8.0
   Compiling axlog v0.1.0 (/home/winddevil/workspace/arceos/modules/axlog)
   Compiling bitflags v1.3.2
   Compiling axio v0.1.0
   Compiling spin v0.9.8
   Compiling allocator v0.1.0 (https://github.com/arceos-org/allocator.git?tag=v0.1.0#16496d88)
   Compiling axdriver_net v0.1.0 (https://github.com/arceos-org/axdriver_crates.git?tag=v0.1.0#78686a7e)
   Compiling axalloc v0.1.0 (/home/winddevil/workspace/arceos/modules/axalloc)
   Compiling virtio-drivers v0.7.4
   Compiling axhal v0.1.0 (/home/winddevil/workspace/arceos/modules/axhal)
   Compiling chrono v0.4.38
   Compiling page_table_entry v0.4.0
   Compiling axdriver_virtio v0.1.0 (https://github.com/arceos-org/axdriver_crates.git?tag=v0.1.0#78686a7e)
   Compiling axdriver_pci v0.1.0 (https://github.com/arceos-org/axdriver_crates.git?tag=v0.1.0#78686a7e)
   Compiling page_table_multiarch v0.4.0
error[E0425]: cannot find function `init_boot_page_table` in module `crate::platform::mem`
   --> modules/axhal/src/platform/aarch64_common/boot.rs:100:27
    |
100 |     crate::platform::mem::init_boot_page_table(addr_of_mut!(BOOT_PT_L0), addr_of_mut!(BOOT_PT_L1));
    |                           ^^^^^^^^^^^^^^^^^^^^ not found in `crate::platform::mem`

error[E0425]: cannot find value `rust_entry` in module `crate::platform`
   --> modules/axhal/src/platform/aarch64_common/boot.rs:139:38
    |
139 |         entry = sym crate::platform::rust_entry,
    |                                      ^^^^^^^^^^ not found in `crate::platform`

error[E0425]: cannot find value `rust_entry_secondary` in module `crate::platform`
   --> modules/axhal/src/platform/aarch64_common/boot.rs:170:38
    |
170 |         entry = sym crate::platform::rust_entry_secondary,
    |                                      ^^^^^^^^^^^^^^^^^^^^ not found in `crate::platform`

error[E0425]: cannot find value `PSCI_METHOD` in crate `axconfig`
  --> modules/axhal/src/platform/aarch64_common/psci.rs:82:31
   |
82 |     let ret = match axconfig::PSCI_METHOD {
   |                               ^^^^^^^^^^^ not found in `axconfig`

error[E0425]: cannot find value `PSCI_METHOD` in crate `axconfig`
  --> modules/axhal/src/platform/aarch64_common/psci.rs:85:58
   |
85 |         _ => panic!("Unknown PSCI method: {}", axconfig::PSCI_METHOD),
   |                                                          ^^^^^^^^^^^ not found in `axconfig`

error[E0425]: cannot find value `UART_PADDR` in crate `axconfig`
 --> modules/axhal/src/platform/aarch64_common/pl011.rs:9:43
  |
9 | const UART_BASE: PhysAddr = pa!(axconfig::UART_PADDR);
  |                                           ^^^^^^^^^^ not found in `axconfig`

For more information about this error, try `rustc --explain E0425`.
error: could not compile `axhal` (lib) due to 6 previous errors
warning: build failed, waiting for other jobs to finish...
```

这里有个非常重要的细节,我们报告的错都是`modules/axhal/src/platform/aarch64_common`这个文件夹里的.

那么我们发现这个`paltform`不对啊,它怎么不给我编译`aarch64-qemu-virt`呢?

> 这里要提到一个我们经常会使用到的东西,即查看`make`过程的`V=1`,在`make`指令后边加上这句,就可以看到`make`的过程

然后我们看到:
```shell
APP: "examples/httpclient"
APP_TYPE: "rust"
FEATURES: ""
arceos features: "axstd/log-level-debug"
lib features: "axstd/smp"
app features: ""
RUSTFLAGS: "-C link-arg=-T/home/winddevil/workspace/arceos/target/aarch64-unknown-none-softfloat/release/linker_aarch64-qemu-virt.lds -C link-arg=-no-pie -C link-arg=-znostart-stop-gc"
```

这里是来自`scripts/make/build.mk`:
```shell
ifneq ($(filter $(MAKECMDGOALS),doc doc_check_missing),)  # run `cargo doc`
  $(if $(V), $(info RUSTDOCFLAGS: "$(RUSTDOCFLAGS)"))
  export RUSTDOCFLAGS
else ifeq ($(filter $(MAKECMDGOALS),clippy unittest unittest_no_fail_fast),) # not run `cargo test` or `cargo clippy`
  ifneq ($(V),)
    $(info APP: "$(APP)")
    $(info APP_TYPE: "$(APP_TYPE)")
    $(info FEATURES: "$(FEATURES)")
    $(info arceos features: "$(AX_FEAT)")
    $(info lib features: "$(LIB_FEAT)")
    $(info app features: "$(APP_FEAT)")
  endif
  ifeq ($(APP_TYPE), c)
    $(if $(V), $(info CFLAGS: "$(CFLAGS)") $(info LDFLAGS: "$(LDFLAGS)"))
  else
    $(if $(V), $(info RUSTFLAGS: "$(RUSTFLAGS)"))
    export RUSTFLAGS
  endif
endif
```

> 这里后来发现两个问题,一个是虽然输出了几个关键的环境变量还是没有输出全部的环境变量还是会导致不能编译

这里介绍一个关键字`export`:

```shell
export [-fnp][变量名称]=[变量设置值]
 
参数说明：
 
-f 　代表[变量名称]中为函数名称。
-n 　删除指定的变量。变量实际上并未删除，只是不会输出到后续指令的执行环境中。
-p 　列出所有的shell赋予程序的环境变量。
```

上述是通过`export`的环境变量.

那么其中有一个比较可疑的,就是`RUSTFLAGS`,在[这里](https://rustwiki.org/zh-CN/cargo/reference/environment-variables.html):

> 自定义参数的空格分隔列表，用来传递给 Cargo 执行的所有编译器调用。与`cargo rustc`不同，这对于传递一个标志 _全部的_ 编译实例是有用的。

经过多次尝试,设置这两个环境变量即可编译:
```shell
export RUSTFLAGS="-C link-arg=-T/home/winddevil/workspace/arceos/target/aarch64-unknown-none-softfloat/release/linker_aarch64-qemu-virt.lds -C link-arg=-no-pie -C link-arg=-znostart-stop-gc"
export AX_PLATFORM="aarch64-qemu-virt"
cargo -C examples/httpclient build -Z unstable-options --target aarch64-unknown-none-softfloat --target-dir /home/winddevil/workspace/arceos/target --release  --features "axstd/log-level-debug axstd/smp"
```

这说明了编译流程里是有设置很多环境变量的.

编译过程很好理解:

![](00%20inbox/asset/Pasted%20image%2020241208170548.png)

> 但是仍然没有办法解决在`cargo build`的时候到底有哪些环境变量被`export`了.

我们搜索`export`,其实也不多:
```makefile
// Makefile

export AX_ARCH=$(ARCH)
export AX_PLATFORM=$(PLATFORM_NAME)
export AX_SMP=$(SMP)
export AX_MODE=$(MODE)
export AX_LOG=$(LOG)
export AX_TARGET=$(TARGET)
export AX_IP=$(IP)
export AX_GW=$(GW)

// scripts/make/build.mk

ifneq ($(filter $(MAKECMDGOALS),doc doc_check_missing),)  # run `cargo doc`
  $(if $(V), $(info RUSTDOCFLAGS: "$(RUSTDOCFLAGS)"))
  export RUSTDOCFLAGS
else ifeq ($(filter $(MAKECMDGOALS),clippy unittest unittest_no_fail_fast),) # not run `cargo test` or `cargo clippy`
  ifneq ($(V),)
    $(info APP: "$(APP)")
    $(info APP_TYPE: "$(APP_TYPE)")
    $(info FEATURES: "$(FEATURES)")
    $(info arceos features: "$(AX_FEAT)")
    $(info lib features: "$(LIB_FEAT)")
    $(info app features: "$(APP_FEAT)")
  endif
  ifeq ($(APP_TYPE), c)
    $(if $(V), $(info CFLAGS: "$(CFLAGS)") $(info LDFLAGS: "$(LDFLAGS)"))
  else
    $(if $(V), $(info RUSTFLAGS: "$(RUSTFLAGS)"))
    export RUSTFLAGS
  endif
endif
```

我们需要看看各个包在编译的时候,`build.rs`是怎么运行的,会加入什么环境变量进去.

依赖图:

![](00%20inbox/asset/Pasted%20image%2020241208170513.png)

这里边最重要的就是`config.rs`,它是由`axconfig`进行编译的时候`build.rs`生成的.

### `build.rs`解析

```rust
use std::io::{Result, Write};
use std::path::{Path, PathBuf};
use toml_edit::{Decor, DocumentMut, Item, Table, Value};

fn resolve_config_path(platform: Option<&str>) -> Result<PathBuf> {
    let mut root_dir = PathBuf::from(std::env!("CARGO_MANIFEST_DIR"));
    root_dir.extend(["..", ".."]);
    let config_dir = root_dir.join("platforms");

    let builtin_platforms = std::fs::read_dir(&config_dir)?
        .filter_map(|e| {
            e.unwrap()
                .file_name()
                .to_str()?
                .strip_suffix(".toml")
                .map(String::from)
        })
        .collect::<Vec<_>>();

    let path = match platform {
        None | Some("") => "defconfig.toml".into(),
        Some(plat) if builtin_platforms.contains(&plat.to_string()) => {
            config_dir.join(format!("{plat}.toml"))
        }
        Some(plat) => {
            let path = PathBuf::from(&plat);
            if path.is_absolute() {
                path
            } else {
                root_dir.join(plat)
            }
        }
    };

    Ok(path)
}

fn get_comments<'a>(config: &'a Table, key: &str) -> Option<&'a str> {
    config
        .key(key)
        .and_then(|k| k.leaf_decor().prefix())
        .and_then(|s| s.as_str())
        .map(|s| s.trim())
}

fn add_config(config: &mut Table, key: &str, item: Item, comments: Option<&str>) {
    config.insert(key, item);
    if let Some(comm) = comments {
        if let Some(mut dst) = config.key_mut(key) {
            *dst.leaf_decor_mut() = Decor::new(comm, "");
        }
    }
}

fn load_config_toml(config_path: &Path) -> Result<Table> {
    let config_content = std::fs::read_to_string(config_path)?;
    let toml = config_content
        .parse::<DocumentMut>()
        .expect("failed to parse config file")
        .as_table()
        .clone();
    Ok(toml)
}

fn gen_config_rs(config_path: &Path) -> Result<Vec<u8>> {
    fn is_num(s: &str) -> bool {
        let s = s.replace('_', "");
        if s.parse::<usize>().is_ok() {
            true
        } else if let Some(s) = s.strip_prefix("0x") {
            usize::from_str_radix(s, 16).is_ok()
        } else {
            false
        }
    }

    // Load TOML config file
    let mut config = if config_path == Path::new("defconfig.toml") {
        load_config_toml(config_path)?
    } else {
        // Set default values for missing items
        let defconfig = load_config_toml(Path::new("defconfig.toml"))?;
        let mut config = load_config_toml(config_path)?;

        for (key, item) in defconfig.iter() {
            if !config.contains_key(key) {
                add_config(
                    &mut config,
                    key,
                    item.clone(),
                    get_comments(&defconfig, key),
                );
            }
        }
        config
    };

    add_config(
        &mut config,
        "smp",
        toml_edit::value(std::env::var("AX_SMP").unwrap_or("1".into())),
        Some("# Number of CPUs"),
    );

    // Generate config.rs
    let mut output = Vec::new();
    writeln!(
        output,
        "// Platform constants and parameters for {}.",
        config["platform"].as_str().unwrap(),
    )?;
    writeln!(output, "// Generated by build.rs, DO NOT edit!\n")?;

    for (key, item) in config.iter() {
        let var_name = key.to_uppercase().replace('-', "_");
        if let Item::Value(value) = item {
            let comments = get_comments(&config, key)
                .unwrap_or_default()
                .replace('#', "///");
            match value {
                Value::String(s) => {
                    writeln!(output, "{comments}")?;
                    let s = s.value();
                    if is_num(s) {
                        writeln!(output, "pub const {var_name}: usize = {s};")?;
                    } else {
                        writeln!(output, "pub const {var_name}: &str = \"{s}\";")?;
                    }
                }
                Value::Array(regions) => {
                    if key != "mmio-regions" && key != "virtio-mmio-regions" && key != "pci-ranges"
                    {
                        continue;
                    }
                    writeln!(output, "{comments}")?;
                    writeln!(output, "pub const {var_name}: &[(usize, usize)] = &[")?;
                    for r in regions.iter() {
                        let r = r.as_array().unwrap();
                        writeln!(
                            output,
                            "    ({}, {}),",
                            r.get(0).unwrap().as_str().unwrap(),
                            r.get(1).unwrap().as_str().unwrap()
                        )?;
                    }
                    writeln!(output, "];")?;
                }
                _ => {}
            }
        }
    }

    Ok(output)
}

fn main() -> Result<()> {
    let platform = option_env!("AX_PLATFORM");
    let config_path = resolve_config_path(platform)?;

    println!("Reading config file: {:?}", config_path);
    let config_rs = gen_config_rs(&config_path)?;

    let out_dir = std::env::var("OUT_DIR").unwrap();
    let out_path = Path::new(&out_dir).join("config.rs");
    println!("Generating config file: {}", out_path.display());
    std::fs::write(out_path, config_rs)?;

    println!("cargo:rerun-if-changed={}", config_path.display());
    println!("cargo:rerun-if-env-changed=AX_PLATFORM");
    println!("cargo:rerun-if-env-changed=AX_SMP");
    Ok(())
}

```

我们通过在编译过程中加入`-vv`查看更详细的编译过程,即:
```shell
export RUSTFLAGS="-C link-arg=-T/home/winddevil/workspace/arceos/target/aarch64-unknown-none-softfloat/release/linker_aarch64-qemu-virt.lds -C link-arg=-no-pie -C link-arg=-znostart-stop-gc"
export AX_PLATFORM="aarch64-qemu-virt"
cargo -C examples/httpclient build -Z unstable-options --target aarch64-unknown-none-softfloat --target-dir /home/winddevil/workspace/arceos/target --release  --features "axstd/log-level-debug axstd/smp" -vv
```

可以看到一个好的信息,
```shell
[axconfig 0.1.0] Generating config file: /home/winddevil/workspace/arceos/target/release/build/axconfig-f271638000f4f11a/out/config.rs
```

我们直接打开这个文件看即可:
```rust
// Platform constants and parameters for aarch64-qemu-virt.
// Generated by build.rs, DO NOT edit!

/// Architecture identifier.
pub const ARCH: &str = "aarch64";
/// Platform identifier.
pub const PLATFORM: &str = "aarch64-qemu-virt";
/// Platform family.
pub const FAMILY: &str = "aarch64-qemu-virt";
/// Base address of the whole physical memory.
pub const PHYS_MEMORY_BASE: usize = 0x4000_0000;
/// Size of the whole physical memory.
pub const PHYS_MEMORY_SIZE: usize = 0x800_0000;
/// Base physical address of the kernel image.
pub const KERNEL_BASE_PADDR: usize = 0x4008_0000;
/// Base virtual address of the kernel image.
pub const KERNEL_BASE_VADDR: usize = 0xffff_0000_4008_0000;
/// Linear mapping offset, for quick conversions between physical and virtual
/// addresses.
pub const PHYS_VIRT_OFFSET: usize = 0xffff_0000_0000_0000;
/// Offset of bus address and phys address. some boards, the bus address is
/// different from the physical address.
pub const PHYS_BUS_OFFSET: usize = 0;
/// Kernel address space base.
pub const KERNEL_ASPACE_BASE: usize = 0xffff_0000_0000_0000;
/// Kernel address space size.
pub const KERNEL_ASPACE_SIZE: usize = 0x0000_ffff_ffff_f000;
/// MMIO regions with format (`base_paddr`, `size`).
pub const MMIO_REGIONS: &[(usize, usize)] = &[
    (0x0900_0000, 0x1000),
    (0x0910_0000, 0x1000),
    (0x0800_0000, 0x2_0000),
    (0x0a00_0000, 0x4000),
    (0x1000_0000, 0x2eff_0000),
    (0x40_1000_0000, 0x1000_0000),
];
/// VirtIO MMIO regions with format (`base_paddr`, `size`).
pub const VIRTIO_MMIO_REGIONS: &[(usize, usize)] = &[
    (0x0a00_0000, 0x200),
    (0x0a00_0200, 0x200),
    (0x0a00_0400, 0x200),
    (0x0a00_0600, 0x200),
    (0x0a00_0800, 0x200),
    (0x0a00_0a00, 0x200),
    (0x0a00_0c00, 0x200),
    (0x0a00_0e00, 0x200),
    (0x0a00_1000, 0x200),
    (0x0a00_1200, 0x200),
    (0x0a00_1400, 0x200),
    (0x0a00_1600, 0x200),
    (0x0a00_1800, 0x200),
    (0x0a00_1a00, 0x200),
    (0x0a00_1c00, 0x200),
    (0x0a00_1e00, 0x200),
    (0x0a00_3000, 0x200),
    (0x0a00_2200, 0x200),
    (0x0a00_2400, 0x200),
    (0x0a00_2600, 0x200),
    (0x0a00_2800, 0x200),
    (0x0a00_2a00, 0x200),
    (0x0a00_2c00, 0x200),
    (0x0a00_2e00, 0x200),
    (0x0a00_3000, 0x200),
    (0x0a00_3200, 0x200),
    (0x0a00_3400, 0x200),
    (0x0a00_3600, 0x200),
    (0x0a00_3800, 0x200),
    (0x0a00_3a00, 0x200),
    (0x0a00_3c00, 0x200),
    (0x0a00_3e00, 0x200),
];
/// Base physical address of the PCIe ECAM space.
pub const PCI_ECAM_BASE: usize = 0x40_1000_0000;
/// End PCI bus number (`bus-range` property in device tree).
pub const PCI_BUS_END: usize = 0xff;
/// PCI device memory ranges (`ranges` property in device tree).
pub const PCI_RANGES: &[(usize, usize)] = &[
    (0x3ef_f0000, 0x1_0000),
    (0x1000_0000, 0x2eff_0000),
    (0x80_0000_0000, 0x80_0000_0000),
];
/// UART Address
pub const UART_PADDR: usize = 0x0900_0000;

pub const UART_IRQ: usize = 1;
/// GICC Address
pub const GICC_PADDR: usize = 0x0801_0000;

pub const GICD_PADDR: usize = 0x0800_0000;
/// PSCI
pub const PSCI_METHOD: &str = "hvc";
/// pl031@9010000 {
///     clock-names = "apb_pclk";
///     clocks = <0x8000>;
///     interrupts = <0x00 0x02 0x04>;
///     reg = <0x00 0x9010000 0x00 0x1000>;
///     compatible = "arm,pl031\0arm,primecell";
/// };
/// RTC (PL031) Address
pub const RTC_PADDR: usize = 0x901_0000;
/// Timer interrupt frequency in Hz.
pub const TIMER_FREQUENCY: usize = 0;
/// Stack size of each task.
pub const TASK_STACK_SIZE: usize = 0x40000;
/// Number of timer ticks per second (Hz). A timer tick may contain several timer
/// interrupts.
pub const TICKS_PER_SEC: usize = 100;
/// Number of CPUs
pub const SMP: usize = 1;

```

由于`modules/axconfig/src/lib.rs`里有:
```rust
#[rustfmt::skip]
mod config {
    include!(concat!(env!("OUT_DIR"), "/config.rs"));
}
```

那么我们可以看到一些使用了`axconfig::xx`的引用的来源.

## 透传到`host`的`net0`网络后端和`5555`端口是怎么被访问到的?


![](00%20inbox/asset/Pasted%20image%2020241208180438.png)

### 解析`modules/axdriver/src/ixgbe.rs`




## log

这里是log:
```shell
qemu-system-aarch64 -m 128M -smp 2 -cpu cortex-a72 -machine virt -kernel examples/httpclient/httpclient_aarch64-qemu-virt.bin -device virtio-net-pci,netdev=net0 -netdev user,id=net0,hostfwd=tcp::5555-:5555,hostfwd=udp::5555-:5555 -nographic

       d8888                            .d88888b.   .d8888b.
      d88888                           d88P" "Y88b d88P  Y88b
     d88P888                           888     888 Y88b.
    d88P 888 888d888  .d8888b  .d88b.  888     888  "Y888b.
   d88P  888 888P"   d88P"    d8P  Y8b 888     888     "Y88b.
  d88P   888 888     888      88888888 888     888       "888
 d8888888888 888     Y88b.    Y8b.     Y88b. .d88P Y88b  d88P
d88P     888 888      "Y8888P  "Y8888   "Y88888P"   "Y8888P"

arch = aarch64
platform = aarch64-qemu-virt
target = aarch64-unknown-none-softfloat
smp = 2
build_mode = release
log_level = debug

[  0.005105 axruntime:130] Logging is enabled.
[  0.006216 axruntime:131] Primary CPU 0 started, dtb = 0x44000000.
[  0.007098 axruntime:133] Found physcial memory regions:
[  0.007682 axruntime:135]   [PA:0x40080000, PA:0x400a6000) .text (READ | EXECUTE | RESERVED)
[  0.008824 axruntime:135]   [PA:0x400a6000, PA:0x400af000) .rodata (READ | RESERVED)
[  0.009895 axruntime:135]   [PA:0x400af000, PA:0x400b3000) .data .tdata .tbss .percpu (READ | WRITE | RESERVED)
[  0.011083 axruntime:135]   [PA:0x400b3000, PA:0x40133000) boot stack (READ | WRITE | RESERVED)
[  0.011895 axruntime:135]   [PA:0x40133000, PA:0x40159000) .bss (READ | WRITE | RESERVED)
[  0.012720 axruntime:135]   [PA:0x40159000, PA:0x48000000) free memory (READ | WRITE | FREE)
[  0.013704 axruntime:135]   [PA:0x9000000, PA:0x9001000) mmio (READ | WRITE | DEVICE | RESERVED)
[  0.014160 axruntime:135]   [PA:0x9100000, PA:0x9101000) mmio (READ | WRITE | DEVICE | RESERVED)
[  0.015061 axruntime:135]   [PA:0x8000000, PA:0x8020000) mmio (READ | WRITE | DEVICE | RESERVED)
[  0.016082 axruntime:135]   [PA:0xa000000, PA:0xa004000) mmio (READ | WRITE | DEVICE | RESERVED)
[  0.017048 axruntime:135]   [PA:0x10000000, PA:0x3eff0000) mmio (READ | WRITE | DEVICE | RESERVED)
[  0.017742 axruntime:135]   [PA:0x4010000000, PA:0x4020000000) mmio (READ | WRITE | DEVICE | RESERVED)
[  0.018484 axruntime:208] Initialize global memory allocator...
[  0.019127 axruntime:209]   use TLSF allocator.
[  0.019775 axalloc:212] initialize global allocator at: [0xffff000040159000, 0xffff000048000000)
[  0.020798 axmm:60] Initialize virtual memory management...
[  0.027013 axmm:63] kernel address space init OK: AddrSpace {
    va_range: VA:0xffff000000000000..VA:0xfffffffffffff000,
    page_table_root: PA:0x40161000,
}
[  0.028517 axruntime:150] Initialize platform devices...
[  0.028923 axdriver:152] Initialize device drivers...
[  0.029312 axdriver:153]   device model: static
[  0.029799 axdriver::bus::pci:97] PCI 00:00.0: 1b36:0008 (class 06.00, rev 00) Standard
[  0.031156 axdriver::bus::pci:97] PCI 00:01.0: 1af4:1000 (class 02.00, rev 00) Standard
[  0.031683 axdriver::bus::pci:54]   BAR 1: MEM [0x10000000, 0x10001000)
[  0.032182 axdriver::bus::pci:54]   BAR 4: MEM [0x10004000, 0x10008000) 64bit pref
[  0.034618 virtio_drivers::transport:78] Device features: Features(CTRL_GUEST_OFFLOADS | MAC | MRG_RXBUF | STATUS | CTRL_VQ | CTRL_RX | CTRL_VLAN | CTRL_RX_EXTRA | GUEST_ANNOUNCE | CTL_MAC_ADDR | RING_INDIRECT_DESC | RING_EVENT_IDX | VERSION_1)
[  0.036068 virtio_drivers::device::net::dev_raw:30] negotiated_features Features(MAC | STATUS | RING_INDIRECT_DESC | RING_EVENT_IDX)
[  0.036781 virtio_drivers::device::net::dev_raw:37] Got MAC=[52, 54, 00, 12, 34, 56], status=Status(LINK_UP)
[  0.038039 axalloc:118] expand heap memory: [0xffff0000403a5000, 0xffff0000403e5000)
[  0.039351 axdriver::bus::pci:104] registered a new Net device at 00:01.0: "virtio-net"
[  0.050505 axdriver:160] number of NICs: 1
[  0.050868 axdriver:163]   NIC 0: "virtio-net"
[  0.051241 axnet:43] Initialize network subsystem...
[  0.051457 axnet:46]   use NIC 0: "virtio-net"
[  0.051956 axalloc:118] expand heap memory: [0xffff0000403e5000, 0xffff0000404e5000)
[  0.052391 axalloc:118] expand heap memory: [0xffff0000404e5000, 0xffff0000406e5000)
[  0.053174 axnet::smoltcp_impl:332] created net interface "eth0":
[  0.053471 axnet::smoltcp_impl:333]   ether:    52-54-00-12-34-56
[  0.054021 axnet::smoltcp_impl:334]   ip:       10.0.2.15/24
[  0.054368 axnet::smoltcp_impl:335]   gateway:  10.0.2.2
[  0.054664 axruntime::mp:19] starting CPU 1...
[  0.054937 axhal::platform::aarch64_common::psci:113] Starting CPU 1 ON ...
[  0.055480 axruntime:186] Primary CPU 0 init OK.
[  0.056642 axruntime::mp:36] Secondary CPU 1 started.
[  0.056872 axruntime::mp:46] Secondary CPU 1 init OK.
Hello, simple http client!
dest: 49.12.234.183:80 (49.12.234.183:80)
[  0.058237 0 axnet::smoltcp_impl:100] socket #0: created
[  0.059213 0 smoltcp::iface::interface:1473] address 10.0.2.2 not in neighbor cache, sending ARP request
[  0.386031 0 axnet::smoltcp_impl::tcp:430] TCP socket #0: connected to 49.12.234.183:80
HTTP/1.1 200 OK
Server: nginx
Date: Sat, 07 Dec 2024 07:03:37 GMT
Content-Type: text/plain
Content-Length: 14
Connection: keep-alive
Access-Control-Allow-Origin: *
Cache-Control: no-cache, no-store, must-revalidate

211.83.106.222
[  0.675625 0 axnet::smoltcp_impl::tcp:247] TCP socket #0: shutting down
[  0.676139 0 axnet::smoltcp_impl:128] socket #0: destroyed
[  0.676366 0 axruntime:199] main task exited: exit_code=0
[  0.676586 0 axhal::platform::aarch64_common::psci:96] Shutting down...
```

# 技术交流会议内容

## 技术文档

[igb-driver/doc/tack.md at main · qclic/igb-driver](https://github.com/qclic/igb-driver/blob/main/doc/tack.md)

## 会议内容

主要看一下设备树和BAR空间的概念。

4.5节讲了怎么进行初始化。

![](00%20inbox/asset/Pasted%20image%2020241210234315.png)


怎么完成这个初始化呢?**操作寄存器**

![](00%20inbox/asset/Pasted%20image%2020241210234457.png)

说明reset成功
![](00%20inbox/asset/Pasted%20image%2020241210235447.png)

![](00%20inbox/asset/Pasted%20image%2020241210235417.png)

![](00%20inbox/asset/Pasted%20image%2020241210235349.png)


# 初始化流程

## 关中断

![](00%20inbox/asset/Pasted%20image%2020241211185911.png)

### 在发出全局重置后，也需要禁用中断

- [ ] 

### IMC 寄存器

![](00%20inbox/asset/Pasted%20image%2020241211190003.png)
![](00%20inbox/asset/Pasted%20image%2020241211191138.png)

## 全局Reset并且进行常规配置

![](00%20inbox/asset/Pasted%20image%2020241211192440.png)

### `CTRL`寄存器

![](00%20inbox/asset/Pasted%20image%2020241211193835.png)

### `RCTL` 寄存器

![](00%20inbox/asset/Pasted%20image%2020241211204307.png)

### `TCTL`寄存器

![](00%20inbox/asset/Pasted%20image%2020241211204333.png)

### `RXPBS`寄存器

![](00%20inbox/asset/Pasted%20image%2020241211204419.png)

### `TXPBS`寄存器

![](00%20inbox/asset/Pasted%20image%2020241211204432.png)

## 设置PHY和链接

### CTRL_EXT

![](00%20inbox/asset/Pasted%20image%2020241211232342.png)

### Copper PHY Link设置

[以太网——PHY、MAC和 MII基础知识 - 知乎](https://zhuanlan.zhihu.com/p/585923184)

![](00%20inbox/asset/Pasted%20image%2020241211233057.png)

#### 自动协商

链路的解析流控制行为要放到`CTRL.TFCE`和`CTRL.RFCE`里.

在自动协商结束后,MAC从PHY中识别"链接指示"之前需要设置`CTRL.SLU`.

#### MAC速度解决

1. 根据PHY指示的速度来进行解决
	1. 直接读取PHY寄存器,详见下面一节MDIO的读取
	2. 通过STATUS.SPEED 寄存器来读取PHY的SPD_IND寄存器
2. 软件要求MAC尝试从PHY到MAC RX_CLK自动检测PHY速度，然后相应地编程MAC速度
3. MAC通过使用PHY的内部PHY-到MAC速度指示（SPD_IND），基于PHY指示自动检测和设置MAC的链路速度

##### 强制设置MAC速度

设置`CTRL.frcspd`和`CTRL.speed`

> 这里有一点非常重要,就是在设置一个位的时候,假如我们不知道其原始状态,我们应该先将其清零,然后再设置

##### 使用PHY的指示值

设置`CTRL.ASDE`和`CTRL.FRCSPD`值

#### MAC双工解决

设置`CTRL.frcdplx`和`CTRL.FD`

#### 使用PHY寄存器

暂且跳过，这部分是高级功能，直接通过MDIO接口操作PHY设备

### MDIO接口

1. 物理接口
2. 特殊协议-可以跨连接运行
3. 一组内部的可寻址寄存器

内部和外扩的接口由：
1. 数据线MDIO
2. 时钟线MDC

通过访问MAC的寄存器可以访问这两种接口.

MDC是MDIO的时钟线,这个时钟信号不一定一直要有,只要在有数据的时候有没数据的时候就冻结就行了.最大工作频率为2.5MHz.

MDIO是一种传送PHY和MAC之间命令的双向数据信号,因此MAC可以通过一些指令来读取和写PHY管理寄存器.

直接通过访问MDIC寄存器即可访问这个接口.

### MDIC寄存器

![](00%20inbox/asset/Pasted%20image%2020241214165528.png)

> The PHY address for MDIO accesses is 00001b.

![](00%20inbox/asset/Pasted%20image%2020241215023254.png)

## MAC/PHY 链接设置

这个有4种方法，按照情况

### 自动设置

只需要设置`CTRL.FRCDPLX`和`CTRL.FRCSPD`为`0b`.

### 启动PHY的自动协商

![](00%20inbox/asset/Pasted%20image%2020241217194356.png)

## 接收寄存器初始化

![](00%20inbox/asset/Pasted%20image%2020241217194257.png)

### 初始化多播表

![](00%20inbox/asset/Pasted%20image%2020241217194316.png)
![](00%20inbox/asset/Pasted%20image%2020241217194445.png)

![](00%20inbox/asset/Pasted%20image%2020241217194530.png)

![](00%20inbox/asset/Pasted%20image%2020241217194634.png)

然后这个是11位也就是`[11:0]`,

那么`[11:5]`决定指向哪个寄存器,刚好128个寄存器嘛.

那么`[4:0]`决定是指向哪个位,刚好32个位嘛.

## 接收功能

主要是要学一下`rings`.

### Rx队列分配

接收到的包分为三个阶段:
1. L2 Filters 用于确保包已经收到
2. Pool Select 用于虚拟化环境，定义Rx包的目标虚拟端口（称之为**池**）一个数据包可以与任意数量的端口/池相关联
3. Queue Select 这一步Rx包已经成功通过过滤器，并且和一个或者多个**接收描述符队列**相连接

![](00%20inbox/asset/Pasted%20image%2020241217203351.png)

这是一个类开关结构.

> 这是一种**网络资源虚拟化**,把网卡的接口也就是最上边的,虚拟化成很多有**粒度**的资源

#### 接收数据包的目的地

- 虚拟化
- RSS
- L2以太网过滤器
- L3/L4 5-元组过滤器
- TCP SYN筛选器

>通常，包接收包括识别线上包的存在、执行地址过滤、将包存储在接收数据FIFO中、将数据传输到主机存储器中的16个接收队列中的一个，以及更新接收描述符的状态。

![](00%20inbox/asset/Pasted%20image%2020241218010623.png)

队列分配.

![](00%20inbox/asset/Pasted%20image%2020241218010805.png)

##### 虚拟化

在虚拟化环境中,**DMA资源**被多个软件**共享**.

通过在DMA中分配 **接收描述符队列(receive descriptor queues)** 来完成虚拟化.

将**队列**分配到**虚拟分区**是按**集合**完成的，每个**集合**都有相同数量的**队列**,那么这个队列组合叫做**池**.

虚拟化会为**每个接收到的数据包**分配**一个或者多个池索引**.

包的分配是根据**池索引**和一些其它的**约束**来分配到池中的.

##### RSS

RSS通过将**数据包**分配到不同的**描述符队列**中,在多个处理器核心之间分配数据包处理.

RSS为每个接收到的数据包分配一个**RSS索引**.

包的分配是根据**RSS索引**和一些其它的**约束**(比如上述提到的池索引)来分配到池中的.

##### L2以太网过滤器

这些过滤器根据其**L2以太网类型**来**识别**数据包，并将它们分配给接收队列.

##### L3/L4 5-元组过滤器

识别出**指定的**L3/L4流,或者L3/L4流的组合.

每个过滤器由一个5个元组组成（**协议、源和目标IP地址、源和目标TCP/ UDP端口**）.

##### TCP SYN筛选器

把有`SYN`标志的`TCP`包专门放到一个**独立的队列**里监视.

### 非虚拟化中的队列

![](00%20inbox/asset/Pasted%20image%2020241218012449.png)
### 队列设置寄存器

每一个队列会有一套配置寄存器，用于控制队列操作。

- RDBAL 和 RDBAH — 接收描述符基址
- RDLEN — 接收描述符长度
- RDH — 接收描述符头
- RDT — 接收描述符尾
- RXDCTL — 接收描述符控制
- RXCTL — 接收 DCA 控制

>DCA在网络硬件接口和网络驱动中通常指的是“Direct Cache Access”，即直接缓存访问。DCA是一种硬件技术，旨在通过减少数据在内存和处理器之间的传输延迟来提高网络数据包处理的效率。具体来说，DCA可以将网络数据直接写入处理器的缓存，从而提高数据处理的速度和效率。

一共有16个队列.

定义描述符队列功能的**CSR**被复制了8个副本给**虚拟功能(VF,Virtual Function)索引**,以实现虚拟化.

每一套被复制的寄存器对应了**一组**队列,这些队列的VF index相同.

> 注意是**CSR**被复制了8份,而不是队列被复制了8份.

> 这个虚拟化不是按照队列来划分的,不是说一个队列虚拟出几个队列.而是每个功能都认为自己拥有整个网卡,所以假设你的网卡支持8个虚拟功能（VF），那么每个描述符队列的控制和状态寄存器会被复制8份，每份对应一个VF index（从0到7）。
> (Gen by GPT-4o)

>**SRRCTL（Split and Replication Receive Control）** 寄存器用于控制接收数据包的拆分和复制功能。这些功能在处理网络数据包时可以提高灵活性和性能。
>主要功能包括：
>1.  **数据包拆分（Split）**：
    - 可以将接收到的网络数据包拆分成多个部分，以便于在不同的内存区域中存储。这样可以提高数据包处理的效率，特别是在数据包非常大的情况下。
    - 通过拆分数据包，能够更高效地利用缓存和内存，从而减少处理延迟。
>2. **数据包复制（Replication）**：
    - 允许将接收到的数据包复制到多个队列中。这样可以支持多播和广播数据包的高效处理。
    - 数据包复制有助于在多个处理器核心之间分配接收的网络流量，从而提高处理吞吐量。
>SRRCTL寄存器中的各个字段可以配置这些功能的具体行为，例如启用或禁用拆分和复制、设置拆分的阈值等。

>**PSRTYPE（Packet Split Receive Type）** 寄存器用于指定数据包拆分的类型和模式。它定义了如何将接收到的数据包拆分成不同的部分。
>主要功能包括：
>1. **拆分模式选择**：
    - PSRTYPE寄存器允许选择不同的拆分模式，例如基于数据包头部的拆分、基于数据包长度的拆分等。
    - 不同的拆分模式适用于不同的应用场景，例如高效处理TCP/IP头部、优化内存使用等。
>2. **拆分类型配置**：
    - 可以配置拆分的具体类型，例如将数据包拆分成固定大小的块、将头部和数据部分分开存储等。
    - 通过配置拆分类型，可以更好地优化数据包的处理和存储，提高整体性能。
>PSRTYPE寄存器中的字段用于详细配置这些拆分模式和类型，确保数据包能够按照预期方式进行拆分和处理。

有了上述功能,那么每个虚拟化功能(VF)就可以按照自己的喜好来处理每个数据包,就好像每个数据包都专门发给他一样,**实际上**是拆分复制处理过的数据包.


### 通过L2 Filter 来确保包已经收到

`L2 Filter`被翻译为**二级数据包过滤**.

![](00%20inbox/asset/Pasted%20image%2020241217205544.png)

##### MAC地址过滤

###### 单播过滤器

###### 多播过滤器

##### VLAN 过滤

![](00%20inbox/asset/Pasted%20image%2020241217210226.png)

##### 可管理性过滤

![](00%20inbox/asset/Pasted%20image%2020241217210707.png)

### 五元组过滤器

`#todo`

### RSS接收侧缩放

RSS是一种将接收到的数据包分发到多个描述符队列中的机制。然后，软件将每个队列分配给不同的处理器，在多个处理器之间共享数据包处理的负载。

### VLAN过滤器

`#todo`

## 接收数据存储

### Host Buffer

其大小可以通过`RCTL.BSIZE`设置`packat`的`buffer`的大小,会影响所有的接收队列.

也可也通过**每个队列**的`SRRCTL[n].BSIZEPACKET`来设置.在设置为`0`的时候是采用`RCTL.BSIZE` 的默认设置.

在使用`advanced descriptor`的时候需要通过设置`SRRCTL.BSIZEHEADER`来决定`header`的`buffer`的大小.

### 片上Rx Buffer

>82576包含一个64 KBytes的包缓冲区，可用于存储包，直到它们被转发到主机。
>此外，为了支持第7.10.3节所述的本地包的转发，提供了20kbyt的交换机缓冲区。此缓冲区作为所有本地流量的接收缓冲区。

### 片上descriptor Buffer

> 82576为每个接收队列包含一个32个描述符缓存，用于减少包处理的延迟，并通过突发中获取和写回描述符来优化PCIe带宽的使用。

## 传统接收描述符格式

在`SRRCTL[n],DESCTYPE = 000b`

![](00%20inbox/asset/Pasted%20image%2020241220004631.png)

> 这里ixgbe暂时跳过了,我们也暂时跳过,可以根据Advanced Descriptor来进行后续的补充工作

## 接收描述符Ring结构




# 移植到ixgbe代码

## 寻找igb的id

我们用的是82576，在`ethernet-linux-igb`,也就是`linux`的`igb`驱动项目里的`src/e1000_hw.h`文件夹里可以查出.

> E1000_DEV_ID_82576          0x10C9

## 解决宏定义问题

在`ixgbe-driver`的`src/constants.rs`文件里存在大量的宏,是用于规定一些需要的.

我们把`ethernet-linux-igb`中的`src/e1000_hw.h`的`E1000_DEV_ID_82576`等宏改为`rust`形式,并且重新命名.

> 例如把`E1000_DEV_ID_82576`的名字改为`IGB_DEV_ID_82576`.

## 读取MAC

![](00%20inbox/asset/Pasted%20image%2020241216194732.png)

![](00%20inbox/asset/Pasted%20image%2020241216194803.png)

> 这里有一点语焉不详的地方,就是`RAL0`和`RAH0`是从`EEPROM`加载出来的数据,那么这里有我们需要的数据.


# TIPS

## git的换行符问题

有时候是从windows clone下来的，所以在wsl里是linux方式读取，因此刚刚`clone`下来就是"被更改的状态".

```bash
git config --global core.autocrlf true
```

# 下一步

- [ ] 尝试直接把`axdriver_net`给pull下来,然后把它加一个本地地址,然后把他的依赖改成`workspace`.
[KuangjuX/ixgbe-driver: Intel 82599+ 10Gb NIC Driver.](https://github.com/KuangjuX/ixgbe-driver)
- [ ] `interrupts`和`descriptor`的代码没移植,要考虑在手册里理解这个概念之后在做
- [ ] 寻找`ixgbe`这个框架里和初始化相关的部分,先把会写的部分移植上
[Linux系统e1000e网络驱动源码（最深入）分析过程-CSDN博客](https://blog.csdn.net/Luckiers/article/details/123645030)
[[MIT 6.S081] Lab 11: networking_c版本的e1000网卡实现-CSDN博客](https://blog.csdn.net/LostUnravel/article/details/121437373)

