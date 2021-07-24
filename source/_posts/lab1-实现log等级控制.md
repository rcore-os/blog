---
title: 'lab1: 实现log等级控制 by 樊博'
date: 2021-07-23 04:42:27
categories:
	- report
tags:
	- author:vptvpt
	- summerofcode2021
	- rcore-lab
---

大家好，我是来自哈尔滨工业大学（深圳）的20级本科生。我把我做实验的过程整理成博客，希望得到大家的指正。

<!-- more -->

## 日志的基本输出
Rust中的log库为我们提供了日志的常规操作,比如日志的输出，分级控制等。

但是log只是一个日志门面库。所谓门面，其实就是它定义了一套统一的日志trait API， 抽象出来日志的常规操作，具体的日志库实现它定义的API。例如，输出日志信息可以使用log库提供的`error, warn, info, debug, trace`等输出宏，这些宏输出的日志有不同的级别，但是具体的输出格式取决于具体的日志库的实现，我们要实现的彩色输出，需要对Log trait进行自定义的实现。

我们可以使用log库中的set_logger函数设置具体的日志实现库，在set_logger之前的日志将被忽略。从源码中可以看到，set_logger函数的参数是Log trait的trait对象的具有‘static生命周期的引用。
```Rust
pub fn set_logger(logger: &'static dyn Log) -> Result<(), SetLoggerError>
```

Log trait就是log库中一个重要的API,定义了三个方法。
`fn enabled(&self, metadata: &Metadata) -> bool`返回这条log是否允许输出日志。
`fn log(&self, record: &Record)` 记录这条日志，这里日志使用Record来表示这条日志。
`fn flush(&self)` flush缓存的日志。
用户可以根据需要为具体的日志实现库定义自己的实现。

为了实现自己的日志实现库，需要实现Log的trait object，这里只需要trait,不需要存储数据，所以定义了一个unit-like struct`SimpleLogger`作为具体的日志实现库。
```rust
static LOGGER: SimpleLogger = SimpleLogger;  
//实例化一个SimpleLogger`，作为一个类单元结构体，SimpleLogger既是数据类型，又是该数据类型的值。
log::set_logger(&LOGGER).unwrap();
```
```rust
struct SimpleLogger;

impl Log for SimpleLogger {
    fn enabled(&self, _metadata: &Metadata) -> bool {
        true
		
    }
	
    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }
        print_in_color(
            format_args!(
                "[{}]{}\n",
                record.level（）,
                record.args()
            ),
            level_to_color_code(record.level()),
        );
    }
	
    fn flush(&self) {}
}
```
`enabled`函数返回true，允许输出日志，`log`函数中调用了`print_in_color`函数实现对不同级别日志不同颜色的输出。
```rust
struct Stdout;

impl Write for Stdout {
    fn write_str(&mut self, s: &str) -> fmt::Result {
        for c in s.chars() {
            console_putchar(c as usize);
        }
        Ok(())
    }
}
pub fn print(args: fmt::Arguments) {
    Stdout.write_fmt(args).unwrap();
}
macro_rules! with_color {
    ($args: ident, $color_code: ident) => {{
        format_args!("\u{1B}[{}m{}\u{1B}[0m", $color_code as u8, $args)
    }};
}
fn print_in_color (args:fmt::Arguments,color_code:u8) {
    print(with_color!(args,color_code));
}
```
可以看到，`print_in_color`函数输出的颜色取决于`color_code`参数。在Log trait的具体实现中，调用了`level_to_code`函数。
```rust
fn level_to_color_code(level: Level) -> u8 {
    match level {
        Level::Error => 31, // Red
        Level::Warn => 93,  // BrightYellow
        Level::Info => 34,  // Blue
        Level::Debug => 32, // Green
        Level::Trace => 90, // BrightBlack
    }
}
```
`level_to_code`函数把日志的不同级别映射成了不同的`color_code`。调用log库提供的`level()`方法得到日志的级别，这样就实现了用不同颜色输出不同级别的日志。
## 实现等级控制
log中提供了`set_max_level`函数可以设定输出的等级，`set_max_level`函数的参数是`LevelFilter`类型的枚举。比如：
```rust
log::set_max_level(LevelFilter::Info);//设定输出等级为Info，输出Info等级以及更高输出等级的信息
```

现在的问题在于，如何通过make命令来控制日志的输出等级。我们预期的命令是这样的：
```shell
make run LOG=INFO
```
这里make命令在makefile文件里声明了一个变量LOG并赋值为INFO	。可以把该变量设置为环境变量，提供给我们编写的操作系统使用。

问题在于，我们编写的操作系统是在qemu模拟的裸机上运行的，在运行时无法读取宿主机操作系统的环境变量。

Rust核心库提供的`option_env`宏可以完美地解决一个问题，这个宏可以在编译时检查操作系统的环境变量。如果读取到了想要的环境变量，会返回该环境变量的Some("环境变量的值的形式")。所以只要在编写makefile时，在编译之前将LOG设置为环境变量即可：
```
build:
	@export LOG=$(LOG);cargo build --release
```
将得到的环境变量映射为对应的日志等级，作为`set_max_level`的参数，就达到了控制日志输出等级的目的。
```rust
log::set_max_level(match option_env!("LOG") {
        Some("ERROR") => LevelFilter::Error,
        Some("WARN") => LevelFilter::Warn,
        Some("INFO") => LevelFilter::Info,
        Some("DEBUG") => LevelFilter::Debug,
        Some("TRACE") => LevelFilter::Trace,
        _ => LevelFilter::Info,
    });
```
