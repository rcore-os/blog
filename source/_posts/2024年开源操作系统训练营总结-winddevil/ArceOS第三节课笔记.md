# 抢占式调度

两个实验第二个比第一个多一些关于`wait_queue`的内容.

CFS**公平调度**策略.

抢占式调度的基本保障是**定时器**.

ArceOS的抢占不是无条件的:
1. 内部条件:时间片耗尽
2. 外部条件
	1. 通过关抢占(锁)确定一段执行的过程中不会出现抢占,形成关抢占的临界区
	2. 只有的特定的执行点上才会发生抢占(一个反向的临界区?)

要内外部条件**都满足**.

`preempt_disable_count`是多个结合的,因此计数会大于`1`.只有是`0`的情况下才可以被抢占.

`CFS`比之前的那种抢占式调度不同,加了一种调度算法.

`vruntime = init_vruntime + (delta / weight(nice))`.

系统初始化时,`init_vruntime`, `delta`, `nice`三者都是`0`.但是我们可以人为根据偏好设置`init_vruntime`,但是随着系统运行时间的增加,`init_vruntime`的作用越来越小.

`vruntime`最小的任务就是优先权最高任务,即当前任务.

每次始终中断的时候都会递增`delta`(但是不会直接切换任务,而会运行**优先级最高**的任务),随着`delta`的递增,导致这个任务的优先级不够,然后就会被换掉.

即使下次还是运行自己,还是会发生一次**无用切换**.

## 实验验证

### 第一个实验

`make run A=tour/u_6_0`

出现的log如下:
```shell
OpenSBI v0.9
   ____                    _____ ____ _____
  / __ \                  / ____|  _ \_   _|
 | |  | |_ __   ___ _ __ | (___ | |_) || |
 | |  | | '_ \ / _ \ '_ \ \___ \|  _ < | |
 | |__| | |_) |  __/ | | |____) | |_) || |_
  \____/| .__/ \___|_| |_|_____/|____/_____|
        | |
        |_|

Platform Name             : riscv-virtio,qemu
Platform Features         : timer,mfdeleg
Platform HART Count       : 1
Firmware Base             : 0x80000000
Firmware Size             : 100 KB
Runtime SBI Version       : 0.2

Domain0 Name              : root
Domain0 Boot HART         : 0
Domain0 HARTs             : 0*
Domain0 Region00          : 0x0000000080000000-0x000000008001ffff ()
Domain0 Region01          : 0x0000000000000000-0xffffffffffffffff (R,W,X)
Domain0 Next Address      : 0x0000000080200000
Domain0 Next Arg1         : 0x0000000087000000
Domain0 Next Mode         : S-mode
Domain0 SysReset          : yes

Boot HART ID              : 0
Boot HART Domain          : root
Boot HART ISA             : rv64imafdcsu
Boot HART Features        : scounteren,mcounteren,time
Boot HART PMP Count       : 16
Boot HART PMP Granularity : 4
Boot HART PMP Address Bits: 54
Boot HART MHPM Count      : 0
Boot HART MHPM Count      : 0
Boot HART MIDELEG         : 0x0000000000000222
Boot HART MEDELEG         : 0x000000000000b109

       d8888                            .d88888b.   .d8888b.
      d88888                           d88P" "Y88b d88P  Y88b
     d88P888                           888     888 Y88b.
    d88P 888 888d888  .d8888b  .d88b.  888     888  "Y888b.
   d88P  888 888P"   d88P"    d8P  Y8b 888     888     "Y88b.
  d88P   888 888     888      88888888 888     888       "888
 d8888888888 888     Y88b.    Y8b.     Y88b. .d88P Y88b  d88P
d88P     888 888      "Y8888P  "Y8888   "Y88888P"   "Y8888P"

arch = riscv64
platform = riscv64-qemu-virt
target = riscv64gc-unknown-none-elf
smp = 1
build_mode = release
log_level = warn

Multi-task(Preemptible) is starting ...
worker1 ... ThreadId(4)
worker1 [0]
worker1 [1]
worker1 [2]
worker1 [3]
worker1 [4]
worker1 [5]
worker1 [6]
worker1 [7]
worker1 [8]
worker1 [9]
Wait for workers to exit ...
worker2 ... ThreadId(5)
worker2 [0]
worker2 [1]
worker2 [2]
worker2 [3]
worker2 [4]
worker2 [5]
worker2 [6]
worker2 [7]
worker2 [8]
worker2: nothing to do!
worker2: nothing to do!
worker2: nothing to do!
worker1 [10]
worker2 [9]
worker2: nothing to do!
worker2: nothing to do!
worker1 [11]
worker2 [10]
worker2: nothing to do!
worker1 [12]
worker1 [13]
worker2 [11]
worker2 [12]
worker1 [14]
worker1 [15]
worker2 [13]
worker2 [14]
worker2: nothing to do!
worker1 [16]
worker2 [15]
worker2: nothing to do!
worker1 [17]
worker1 [18]
worker2 [16]
worker2 [17]
worker1 [19]
worker1 [20]
worker2 [18]
worker2 [19]
worker2: nothing to do!
worker1 [21]
worker2 [20]
worker2: nothing to do!
worker1 [22]
worker1 [23]
worker2 [21]
worker2 [22]
worker1 [24]
worker1 [25]
worker2 [23]
worker2 [24]
worker1 [26]
worker1 [27]
worker1 [28]
worker2 [25]
worker2 [26]
worker1 [29]
worker1 [30]
worker2 [27]
worker2 [28]
worker1 [31]
worker1 [32]
worker1 [33]
worker2 [29]
worker2 [30]
worker1 [34]
worker1 [35]
worker2 [31]
worker2 [32]
worker1 [36]
worker1 [37]
worker1 [38]
worker2 [33]
worker2 [34]
worker1 [39]
worker1 [40]
worker2 [35]
worker2 [36]
worker2 [37]
worker1 [41]
worker1 [42]
worker2 [38]
worker2 [39]
worker1 [43]
worker1 [44]
worker2 [40]
worker2 [41]
worker2 [42]
worker1 [45]
worker1 [46]
worker2 [43]
worker2 [44]
worker1 [47]
worker1 [48]
worker2 [45]
worker2 [46]
worker2 [47]
worker1 [49]
worker1 [50]
worker2 [48]
worker2 [49]
worker1 [51]
worker1 [52]
worker2 [50]
worker2 [51]
worker2: nothing to do!
worker1 [53]
worker2 [52]
worker2: nothing to do!
worker1 [54]
worker1 [55]
worker2 [53]
worker2 [54]
worker1 [56]
worker1 [57]
worker2 [55]
worker2 [56]
worker1 [58]
worker1 [59]
worker1 [60]
worker2 [57]
worker2 [58]
worker1 [61]
worker1 [62]
worker2 [59]
worker2 [60]
worker2 [61]
worker1 [63]
worker1 [64]
worker2 [62]
worker2 [63]
worker1 [65]
worker1 [66]
worker2 [64]
worker2 [65]
worker2: nothing to do!
worker1 [67]
worker2 [66]
worker2: nothing to do!
worker1 [68]
worker1 [69]
worker2 [67]
worker2 [68]
worker1 [70]
worker1 [71]
worker2 [69]
worker2 [70]
worker2: nothing to do!
worker1 [72]
worker2 [71]
worker2: nothing to do!
worker1 [73]
worker2 [72]
worker2: nothing to do!
worker1 [74]
worker1 [75]
worker2 [73]
worker2 [74]
worker1 [76]
worker1 [77]
worker1 [78]
worker2 [75]
worker2 [76]
worker1 [79]
worker1 [80]
worker2 [77]
worker2 [78]
worker1 [81]
worker1 [82]
worker1 [83]
worker2 [79]
worker2 [80]
worker1 [84]
worker1 [85]
worker2 [81]
worker2 [82]
worker1 [86]
worker1 [87]
worker1 [88]
worker2 [83]
worker2 [84]
worker1 [89]
worker1 [90]
worker2 [85]
worker2 [86]
worker1 [91]
worker1 [92]
worker1 [93]
worker2 [87]
worker2 [88]
worker1 [94]
worker1 [95]
worker2 [89]
worker2 [90]
worker1 [96]
worker1 [97]
worker1 [98]
worker2 [91]
worker2 [92]
worker1 [99]
worker1 [100]
worker2 [93]
worker2 [94]
worker1 [101]
worker1 [102]
worker2 [95]
worker2 [96]
worker1 [103]
worker1 [104]
worker2 [97]
worker2 [98]
worker2 [99]
worker1 [105]
worker1 [106]
worker2 [100]
worker2 [101]
worker1 [107]
worker1 [108]
worker2 [102]
worker2 [103]
worker1 [109]
worker1 [110]
worker2 [104]
worker2 [105]
worker1 [111]
worker1 [112]
worker2 [106]
worker2 [107]
worker1 [113]
worker1 [114]
worker1 [115]
worker2 [108]
worker2 [109]
worker1 [116]
worker1 [117]
worker2 [110]
worker1 [118]
worker1 [119]
worker2 [111]
worker2 [112]
worker2 [113]
worker1 [120]
worker1 [121]
worker2 [114]
worker2 [115]
worker1 [122]
worker1 [123]
worker2 [116]
worker2 [117]
worker1 [124]
worker1 [125]
worker2 [118]
worker2 [119]
worker1 [126]
worker1 [127]
worker2 [120]
worker2 [121]
worker1 [128]
worker1 [129]
worker2 [122]
worker2 [123]
worker2 [124]
worker1 [130]
worker1 [131]
worker2 [125]
worker2 [126]
worker1 [132]
worker1 [133]
worker2 [127]
worker2 [128]
worker1 [134]
worker1 [135]
worker2 [129]
worker2 [130]
worker1 [136]
worker1 [137]
worker2 [131]
worker2 [132]
worker1 [138]
worker1 [139]
worker2 [133]
worker2 [134]
worker2 [135]
worker1 [140]
worker1 [141]
worker2 [136]
worker2 [137]
worker1 [142]
worker1 [143]
worker2 [138]
worker2 [139]
worker1 [144]
worker1 [145]
worker2 [140]
worker2 [141]
worker1 [146]
worker1 [147]
worker2 [142]
worker2 [143]
worker1 [148]
worker1 [149]
worker2 [144]
worker2 [145]
worker2 [146]
worker1 [150]
worker1 [151]
worker2 [147]
worker2 [148]
worker1 [152]
worker1 [153]
worker2 [149]
worker2 [150]
worker1 [154]
worker1 [155]
worker2 [151]
worker2 [152]
worker1 [156]
worker1 [157]
worker2 [153]
worker2 [154]
worker1 [158]
worker1 [159]
worker2 [155]
worker2 [156]
worker2 [157]
worker1 [160]
worker1 [161]
worker2 [158]
worker2 [159]
worker1 [162]
worker1 [163]
worker2 [160]
worker2 [161]
worker1 [164]
worker1 [165]
worker2 [162]
worker2 [163]
worker1 [166]
worker1 [167]
worker2 [164]
worker2 [165]
worker1 [168]
worker1 [169]
worker2 [166]
worker2 [167]
worker2 [168]
worker1 [170]
worker1 [171]
worker2 [169]
worker2 [170]
worker1 [172]
worker1 [173]
worker2 [171]
worker2 [172]
worker1 [174]
worker1 [175]
worker2 [173]
worker2 [174]
worker1 [176]
worker1 [177]
worker2 [175]
worker2 [176]
worker1 [178]
worker1 [179]
worker2 [177]
worker2 [178]
worker1 [180]
worker1 [181]
worker1 [182]
worker2 [179]
worker2 [180]
worker1 [183]
worker1 [184]
worker2 [181]
worker2 [182]
worker1 [185]
worker1 [186]
worker2 [183]
worker2 [184]
worker1 [187]
worker1 [188]
worker2 [185]
worker2 [186]
worker1 [189]
worker1 [190]
worker2 [187]
worker2 [188]
worker1 [191]
worker1 [192]
worker2 [189]
worker2 [190]
worker1 [193]
worker1 [194]
worker1 [195]
worker2 [191]
worker2 [192]
worker1 [196]
worker1 [197]
worker2 [193]
worker2 [194]
worker1 [198]
worker1 [199]
worker2 [195]
worker2 [196]
worker1 [200]
worker1 [201]
worker2 [197]
worker2 [198]
worker1 [202]
worker1 [203]
worker2 [199]
worker2 [200]
worker1 [204]
worker1 [205]
worker2 [201]
worker2 [202]
worker1 [206]
worker1 [207]
worker2 [203]
worker2 [204]
worker2 [205]
worker1 [208]
worker1 [209]
worker2 [206]
worker2 [207]
worker1 [210]
worker1 [211]
worker2 [208]
worker2 [209]
worker1 [212]
worker1 [213]
worker2 [210]
worker2 [211]
worker1 [214]
worker1 [215]
worker2 [212]
worker2 [213]
worker1 [216]
worker1 [217]
worker2 [214]
worker2 [215]
worker2 [216]
worker1 [218]
worker1 [219]
worker2 [217]
worker2 [218]
worker1 [220]
worker1 [221]
worker2 [219]
worker2 [220]
worker1 [222]
worker1 [223]
worker2 [221]
worker2 [222]
worker1 [224]
worker1 [225]
worker2 [223]
worker2 [224]
worker1 [226]
worker1 [227]
worker1 [228]
worker2 [225]
worker2 [226]
worker1 [229]
worker1 [230]
worker2 [227]
worker2 [228]
worker1 [231]
worker1 [232]
worker2 [229]
worker2 [230]
worker1 [233]
worker1 [234]
worker2 [231]
worker2 [232]
worker1 [235]
worker1 [236]
worker2 [233]
worker2 [234]
worker1 [237]
worker1 [238]
worker1 [239]
worker2 [235]
worker2 [236]
worker1 [240]
worker1 [241]
worker2 [237]
worker2 [238]
worker1 [242]
worker1 [243]
worker2 [239]
worker2 [240]
worker1 [244]
worker1 [245]
worker2 [241]
worker2 [242]
worker1 [246]
worker1 [247]
worker2 [243]
worker2 [244]
worker1 [248]
worker1 [249]
worker1 [250]
worker2 [245]
worker2 [246]
worker1 [251]
worker1 [252]
worker2 [247]
worker2 [248]
worker1 [253]
worker1 [254]
worker2 [249]
worker2 [250]
worker1 [255]
worker1 [256]
worker2 [251]
worker2 [252]
worker1 ok!
worker2 [253]
worker2 [254]
worker2 [255]
worker2 [256]
worker2 ok!
Multi-task(Preemptible) ok!
```

1. 最开始`worker1`运行了9次`println`,但是只运行了8次`push_back`,每次时间片耗尽触发了`cfs`调度算法,但是一直到这时候才轮到`worker2`的`vruntime`最小(**而不是触发时间片耗尽的`round_robin`**).
2. 随后`worker2`获取到**双端队列**之后,尝试输出队列最前边的内容.全部输出完之后,进入另一个分支输出`worker2: nothing to do!`,并且`yield`.但是由于`vruntime`仍然是`worker2`最小,因此又运行了两次,一共运行三次以后才切换回`worker1`.(**这说明`cfs`调度算法的`yield`是考虑切换,而不是直接把当前任务放进队列最后**)
3. `worker1`在输出`worker1 [10]`之后还没来得及把`10`压入队列,这时候又切换回`worker2`.
4. 这时候`worker2`发生了三次`yield`但是还是没有切换到`work1`.于是输出了一次`worker2 [9]`,又触发了两次`worker2: nothing to do!`.
5. 后边也都这样进行分析即可.可以看到在`cfs`算法中,即使你使用了`yield`还是可能切换回本任务.

## 第二个实验

`make run A=tour/u_6_1`

产生的log如下:
```shell
OpenSBI v0.9
   ____                    _____ ____ _____
  / __ \                  / ____|  _ \_   _|
 | |  | |_ __   ___ _ __ | (___ | |_) || |
 | |  | | '_ \ / _ \ '_ \ \___ \|  _ < | |
 | |__| | |_) |  __/ | | |____) | |_) || |_
  \____/| .__/ \___|_| |_|_____/|____/_____|
        | |
        |_|

Platform Name             : riscv-virtio,qemu
Platform Features         : timer,mfdeleg
Platform HART Count       : 1
Firmware Base             : 0x80000000
Firmware Size             : 100 KB
Runtime SBI Version       : 0.2

Domain0 Name              : root
Domain0 Boot HART         : 0
Domain0 HARTs             : 0*
Domain0 Region00          : 0x0000000080000000-0x000000008001ffff ()
Domain0 Region01          : 0x0000000000000000-0xffffffffffffffff (R,W,X)
Domain0 Next Address      : 0x0000000080200000
Domain0 Next Arg1         : 0x0000000087000000
Domain0 Next Mode         : S-mode
Domain0 SysReset          : yes

Boot HART ID              : 0
Boot HART Domain          : root
Boot HART ISA             : rv64imafdcsu
Boot HART Features        : scounteren,mcounteren,time
Boot HART PMP Count       : 16
Boot HART PMP Granularity : 4
Boot HART PMP Address Bits: 54
Boot HART MHPM Count      : 0
Boot HART MHPM Count      : 0
Boot HART MIDELEG         : 0x0000000000000222
Boot HART MEDELEG         : 0x000000000000b109

       d8888                            .d88888b.   .d8888b.
      d88888                           d88P" "Y88b d88P  Y88b
     d88P888                           888     888 Y88b.
    d88P 888 888d888  .d8888b  .d88b.  888     888  "Y888b.
   d88P  888 888P"   d88P"    d8P  Y8b 888     888     "Y88b.
  d88P   888 888     888      88888888 888     888       "888
 d8888888888 888     Y88b.    Y8b.     Y88b. .d88P Y88b  d88P
d88P     888 888      "Y8888P  "Y8888   "Y88888P"   "Y8888P"

arch = riscv64
platform = riscv64-qemu-virt
target = riscv64gc-unknown-none-elf
smp = 1
build_mode = release
log_level = warn

WaitQ is starting ...
worker1 ...
worker1 [0]
worker1 [1]
worker1 [2]
worker1 [3]
worker1 [4]
worker2 ...
Wait for workers to exit ...
worker2 [0]
worker2 [1]
worker2 [2]
worker2 [3]
worker2 [4]
worker1 [5]
worker2 [5]
worker1 [6]
worker2 [6]
worker1 [7]
worker2 [7]
worker1 [8]
worker2 [8]
worker1 [9]
worker2 [9]
worker1 [10]
worker2 [10]
worker1 [11]
worker2 [11]
worker1 [12]
worker2 [12]
worker1 [13]
worker2 [13]
worker1 [14]
worker2 [14]
worker1 [15]
worker2 [15]
worker1 [16]
worker2 [16]
worker1 [17]
worker2 [17]
worker1 [18]
worker2 [18]
worker1 [19]
worker2 [19]
worker1 [20]
worker2 [20]
worker1 [21]
worker2 [21]
worker1 [22]
worker2 [22]
worker1 [23]
worker2 [23]
worker1 [24]
worker2 [24]
worker1 [25]
worker2 [25]
worker1 [26]
worker2 [26]
worker1 [27]
worker2 [27]
worker1 [28]
worker2 [28]
worker1 [29]
worker2 [29]
worker1 [30]
worker2 [30]
worker1 [31]
worker2 [31]
worker1 [32]
worker2 [32]
worker1 [33]
worker2 [33]
worker1 [34]
worker2 [34]
worker1 [35]
worker2 [35]
worker1 [36]
worker2 [36]
worker1 [37]
worker2 [37]
worker1 [38]
worker2 [38]
worker1 [39]
worker2 [39]
worker1 [40]
worker2 [40]
worker1 [41]
worker2 [41]
worker1 [42]
worker2 [42]
worker1 [43]
worker2 [43]
worker1 [44]
worker2 [44]
worker1 [45]
worker2 [45]
worker1 [46]
worker2 [46]
worker1 [47]
worker2 [47]
worker1 [48]
worker2 [48]
worker1 [49]
worker2 [49]
worker1 [50]
worker2 [50]
worker1 [51]
worker2 [51]
worker1 [52]
worker2 [52]
worker1 [53]
worker2 [53]
worker1 [54]
worker2 [54]
worker1 [55]
worker2 [55]
worker1 [56]
worker2 [56]
worker1 [57]
worker2 [57]
worker1 [58]
worker2 [58]
worker1 [59]
worker2 [59]
worker1 [60]
worker2 [60]
worker1 [61]
worker2 [61]
worker1 [62]
worker2 [62]
worker1 [63]
worker2 [63]
worker1 [64]
worker2 [64]
worker1 [65]
worker2 [65]
worker1 [66]
worker2 [66]
worker1 [67]
worker2 [67]
worker1 [68]
worker2 [68]
worker1 [69]
worker2 [69]
worker1 [70]
worker2 [70]
worker1 [71]
worker2 [71]
worker1 [72]
worker2 [72]
worker1 [73]
worker2 [73]
worker1 [74]
worker2 [74]
worker1 [75]
worker2 [75]
worker1 [76]
worker2 [76]
worker1 [77]
worker2 [77]
worker1 [78]
worker2 [78]
worker1 [79]
worker2 [79]
worker1 [80]
worker2 [80]
worker1 [81]
worker2 [81]
worker1 [82]
worker2 [82]
worker1 [83]
worker2 [83]
worker1 [84]
worker2 [84]
worker1 [85]
worker2 [85]
worker1 [86]
worker2 [86]
worker1 [87]
worker2 [87]
worker1 [88]
worker2 [88]
worker1 [89]
worker2 [89]
worker1 [90]
worker2 [90]
worker1 [91]
worker2 [91]
worker1 [92]
worker2 [92]
worker1 [93]
worker2 [93]
worker1 [94]
worker2 [94]
worker1 [95]
worker2 [95]
worker1 [96]
worker2 [96]
worker1 [97]
worker2 [97]
worker1 [98]
worker2 [98]
worker1 [99]
worker2 [99]
worker1 [100]
worker2 [100]
worker1 [101]
worker2 [101]
worker1 [102]
worker2 [102]
worker1 [103]
worker2 [103]
worker1 [104]
worker2 [104]
worker1 [105]
worker2 [105]
worker1 [106]
worker2 [106]
worker1 [107]
worker2 [107]
worker1 [108]
worker2 [108]
worker1 [109]
worker2 [109]
worker1 [110]
worker2 [110]
worker1 [111]
worker2 [111]
worker1 [112]
worker2 [112]
worker1 [113]
worker2 [113]
worker1 [114]
worker2 [114]
worker1 [115]
worker2 [115]
worker1 [116]
worker2 [116]
worker1 [117]
worker2 [117]
worker1 [118]
worker2 [118]
worker1 [119]
worker2 [119]
worker1 [120]
worker2 [120]
worker1 [121]
worker2 [121]
worker1 [122]
worker2 [122]
worker1 [123]
worker2 [123]
worker1 [124]
worker2 [124]
worker1 [125]
worker2 [125]
worker1 [126]
worker2 [126]
worker1 [127]
worker2 [127]
worker1 [128]
worker2 [128]
worker1 [129]
worker2 [129]
worker1 [130]
worker2 [130]
worker1 [131]
worker2 [131]
worker1 [132]
worker2 [132]
worker1 [133]
worker2 [133]
worker1 [134]
worker2 [134]
worker1 [135]
worker2 [135]
worker1 [136]
worker2 [136]
worker1 [137]
worker2 [137]
worker1 [138]
worker2 [138]
worker1 [139]
worker2 [139]
worker1 [140]
worker2 [140]
worker1 [141]
worker2 [141]
worker1 [142]
worker2 [142]
worker1 [143]
worker2 [143]
worker1 [144]
worker2 [144]
worker1 [145]
worker2 [145]
worker1 [146]
worker2 [146]
worker1 [147]
worker2 [147]
worker1 [148]
worker2 [148]
worker1 [149]
worker2 [149]
worker1 [150]
worker2 [150]
worker1 [151]
worker2 [151]
worker1 [152]
worker2 [152]
worker1 [153]
worker2 [153]
worker1 [154]
worker2 [154]
worker1 [155]
worker2 [155]
worker1 [156]
worker2 [156]
worker1 [157]
worker2 [157]
worker1 [158]
worker2 [158]
worker1 [159]
worker2 [159]
worker1 [160]
worker2 [160]
worker1 [161]
worker2 [161]
worker1 [162]
worker2 [162]
worker1 [163]
worker2 [163]
worker1 [164]
worker2 [164]
worker1 [165]
worker2 [165]
worker1 [166]
worker2 [166]
worker1 [167]
worker2 [167]
worker1 [168]
worker2 [168]
worker1 [169]
worker2 [169]
worker1 [170]
worker2 [170]
worker1 [171]
worker2 [171]
worker1 [172]
worker2 [172]
worker1 [173]
worker2 [173]
worker1 [174]
worker2 [174]
worker1 [175]
worker2 [175]
worker1 [176]
worker2 [176]
worker1 [177]
worker2 [177]
worker1 [178]
worker2 [178]
worker1 [179]
worker2 [179]
worker1 [180]
worker2 [180]
worker1 [181]
worker2 [181]
worker1 [182]
worker2 [182]
worker1 [183]
worker2 [183]
worker1 [184]
worker2 [184]
worker1 [185]
worker2 [185]
worker1 [186]
worker2 [186]
worker1 [187]
worker2 [187]
worker1 [188]
worker2 [188]
worker1 [189]
worker2 [189]
worker1 [190]
worker2 [190]
worker1 [191]
worker2 [191]
worker1 [192]
worker2 [192]
worker1 [193]
worker2 [193]
worker1 [194]
worker2 [194]
worker1 [195]
worker2 [195]
worker1 [196]
worker2 [196]
worker1 [197]
worker2 [197]
worker1 [198]
worker2 [198]
worker1 [199]
worker2 [199]
worker1 [200]
worker2 [200]
worker1 [201]
worker2 [201]
worker1 [202]
worker2 [202]
worker1 [203]
worker2 [203]
worker1 [204]
worker2 [204]
worker1 [205]
worker2 [205]
worker1 [206]
worker2 [206]
worker1 [207]
worker2 [207]
worker1 [208]
worker2 [208]
worker1 [209]
worker2 [209]
worker1 [210]
worker2 [210]
worker1 [211]
worker2 [211]
worker1 [212]
worker2 [212]
worker1 [213]
worker2 [213]
worker1 [214]
worker2 [214]
worker1 [215]
worker2 [215]
worker1 [216]
worker2 [216]
worker1 [217]
worker2 [217]
worker1 [218]
worker2 [218]
worker1 [219]
worker2 [219]
worker1 [220]
worker2 [220]
worker1 [221]
worker2 [221]
worker1 [222]
worker2 [222]
worker1 [223]
worker2 [223]
worker1 [224]
worker2 [224]
worker1 [225]
worker2 [225]
worker1 [226]
worker2 [226]
worker1 [227]
worker2 [227]
worker1 [228]
worker2 [228]
worker1 [229]
worker2 [229]
worker1 [230]
worker2 [230]
worker1 [231]
worker2 [231]
worker1 [232]
worker2 [232]
worker1 [233]
worker2 [233]
worker1 [234]
worker2 [234]
worker1 [235]
worker2 [235]
worker1 [236]
worker2 [236]
worker1 [237]
worker2 [237]
worker1 [238]
worker2 [238]
worker1 [239]
worker2 [239]
worker1 [240]
worker2 [240]
worker1 [241]
worker2 [241]
worker1 [242]
worker2 [242]
worker1 [243]
worker2 [243]
worker1 [244]
worker2 [244]
worker1 [245]
worker2 [245]
worker1 [246]
worker2 [246]
worker1 [247]
worker2 [247]
worker1 [248]
worker2 [248]
worker1 [249]
worker2 [249]
worker1 [250]
worker2 [250]
worker1 [251]
worker2 [251]
worker1 [252]
worker2 [252]
worker1 [253]
worker2 [253]
worker1 [254]
worker2 [254]
worker1 [255]
worker2 [255]
worker1 [256]
worker2 [256]
worker2 ok!
worker1 ok!
WaitQ ok!
```

> 可以很明显看到加了`WaitQ`之后`worker1`和`worker2`的调度更**均匀**了,或许说均匀并不好,应该说是`worker2: nothing to do!`基本消失了.

# 块设备

引入块设备之后引入了从块设备去加载磁盘的数据.而不是只读取`PFlash`这种简单的设备.

`AllDevices`管理系统上所有的设备.

`static`用泛型的方法**高效率**地对设备类型进行的封装.因此**一个类型只能管理一个设备**.

用`dyn`的动态方法,其实是利用了**动态可变**的`Vec`每个类型有多个**实例**.

设备的发现方式:
1. 用`pcie`的协议来发现设备
2. `mmio`通过设备树找设备

但是现在没有使用设备树.而是使用**宏**(for_each_drivers!)的方式.

 `virtio`设备是用`qemu`的命令设置出来的虚拟设备.

有八个槽位来放这些驱动.

`virtio-mmio`驱动是对各个槽位发送**查询请求**,就此获得槽位的**设备类型**.

`IPI`中断是多核之间通信的中断,是*软*中断但是是通过发送一个命令到另一个核触发硬中断实现的.

文件系统的操作流程,就是从`Root`节点一直进行`lookup`的方式一直到目标节点,然后对目标节点进行操作.

文件系统的示例:
1. `Ext2`
2. `ArceOS`使用的文件系统是`Fat32`

`mount`可以看成文件系统在内存中的展开操作.

就是目录树存在储存介质里的时候是扁平的,而现在要使用的是展开的立体结构.

`mount`可以把另一个文件系统的目录树挂载到当前文件系统的目录树上.

用`mount`做挂载的时候,可以通过读取最长的路径来解决一部分问题.

## 读取块设备的实验

`make run A=tour/u_7_0 BLK=y`

> 有一个`feature`叫做`dyn`,只有在开启这个的时候才是**每种类型的设备**有一个`Vec`来管理,不然都是**每种类型的设备**都只有一个.

> 这里用的驱动不是`mmio`而是`pci`的驱动,虽然PPT上讲了很多关于`mmio`的内容.这令人感到奇怪,看`modules/axdriver/Cargo.toml`里的描述,`default=["bus-pci"]`,这里我们改成`default = ["bus-mmio"]`也可以正常运行,而且看LOG是不一样的.

> 用`cargo b -vv`在编译的时候看`build.rs`的输出.

> 同样地,这个实验里被预先加载进**块设备**的内容在`scripts/make/utils.mk`里有定义,详见之前的`mk_pflash`的部分.


## 从文件系统加载数据的实验

```shell
make run A=tour/u_8_0 BLK=y
```

这个任务没什么好说的,主要看这个实验的`Cargo`文件,为`axstd`打开了`fs`这个`feature`.

我们可以进去尽情看一下实验中调用的`open`和`read`的实现.

# 为shell增加文件操作命令

> 让我难受了很久的一个问题就是这个`rename`,`ax_rename`对应的`(ax_)fatfs`的`rename`也是只能使用**改名当前目录下的文件**.
> 实际上调用的`rust-fatfs`的`rename`是支持改名一个文件到另一个目录下边的.实际上也就是允许把一个`inode`更替到另一个`inode`下边.
> 这样实际上就能用`rename`实现`mv`的功能.

这一个部分心太急了,没有看其它的`api`的运行流程.

> 在编译运行的时候应该利用好`LOG="level"`
