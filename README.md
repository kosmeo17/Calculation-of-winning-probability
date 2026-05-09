# Bayesian AB 胜出概率网页

## 使用方式

1. 双击打开 `index.html`（或用任意静态服务器打开）。
2. 上传 `CSV/XLSX` 文件。
3. 点击“开始计算”，查看每个指标的胜出概率。

## 输入字段

- `metric`: 指标名称
- `total_A`: 对照组样本量
- `success_A`: 对照组转化人数
- `rev_A`: 对照组转化金额（可空）
- `total_B`: 实验组样本量
- `success_B`: 实验组转化人数
- `rev_B`: 实验组转化金额（可空）

示例见 `sample_data.csv`。

## 计算逻辑说明

该网页按照你提供的 `bayes_ab_test.py` 核心逻辑实现：

- 转化率后验：`Beta(success + 1, total - success + 1)`
- 收入部分后验：`Gamma(k=success+1, theta=1/(1+rev))`
- 蒙特卡洛采样后计算：
  - `convProbBbeatsA`
  - `revProbBbeatsA`
  - `arpuProbBbeatsA`

当 `rev_A` / `rev_B` 缺失时，只计算转化胜出概率。
