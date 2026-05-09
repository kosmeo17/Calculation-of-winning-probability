# -*- coding: UTF-8 -*-

# 导入相关包
from scipy import stats
from scipy.special import betaln
import numpy as np
import math
import pandas as pd
from rpy2 import robjects
import time


class BayesAB(object):
    def __init__(self,ConfidenceLevel):
        self.t = 'y'
        self.credMass = ConfidenceLevel

    def bayes_arpu(self, alphaA, betaA, kA, thetaA,
                   alphaB, betaB, kB, thetaB,
                   MSamples):
        if alphaA <= 0 | betaA <= 0 | alphaB <= 0 | betaB <= 0 | kA <= 0 | thetaA <= 0 | kB <= 0 | thetaB <= 0:
            probBbeatsA = 0
            expLossA = 0
            expLossB = 0
            lambdaA = 0
            lambdaB = 0
            omegaA = 0
            omegaB = 0
        else:
            lambdaA = stats.beta.rvs(alphaA, betaA, size=MSamples)
            lambdaB = stats.beta.rvs(alphaB, betaB, size=MSamples)
            omegaA = stats.gamma.rvs(kA, scale=thetaA, size=MSamples)
            omegaB = stats.gamma.rvs(kB, scale=thetaB, size=MSamples)

            convProbBbeatsA = sum(lambdaB > lambdaA) / MSamples
            diffTemp = lambdaB - lambdaA
            convExpLossA = sum(diffTemp * (diffTemp > 0)) / MSamples
            convExpLossB = sum(-diffTemp * (-diffTemp > 0)) / MSamples

            revProbBbeatsA = sum(1 / omegaB > 1 / omegaA) / MSamples
            diffTemp = 1 / omegaB - 1 / omegaA
            revExpLossA = sum(diffTemp * (diffTemp > 0)) / MSamples
            revExpLossB = sum(-diffTemp * (-diffTemp > 0)) / MSamples

            arpuProbBbeatsA = sum(lambdaB / omegaB > lambdaA / omegaA) / MSamples
            diffTemp = lambdaB / omegaB - lambdaA / omegaA
            arpuExpLossA = sum(diffTemp * (diffTemp > 0)) / MSamples
            arpuExpLossB = sum(-diffTemp * (-diffTemp > 0)) / MSamples

        result = {
            'convProbBbeatsA': convProbBbeatsA,
            'convExpLossA': convExpLossA,
            'convExpLossB': convExpLossB,
            'revProbBbeatsA': revProbBbeatsA,
            'revExpLossA': revExpLossA,
            'revExpLossB': revExpLossB,
            'arpuProbBbeatsA': arpuProbBbeatsA,
            'arpuExpLossA': arpuExpLossA,
            'arpuExpLossB': arpuExpLossB,
            'sampleLambdaA': lambdaA,
            'sampleLambdaB': lambdaB,
            'sampleOmegaA': omegaA,
            'sampleOmegaB': omegaB
        }
        return result

    # 95%置信度获取函数
    def hdi_of_sample(self, sampleVec):
        sortedPts = np.sort(sampleVec)
        sortedPtsLength = sortedPts.size
        if sortedPtsLength >= 3:
            ciIdxInc = min(math.ceil(self.credMass * sortedPtsLength), sortedPtsLength - 1)
            nCIs = sortedPtsLength - ciIdxInc
            ciWidth = np.zeros(nCIs)
            # 从0开始索引（ R从1开始索引，如1:nCIs）
            for i in range(0, nCIs):
                ciWidth[i] = sortedPts[i + ciIdxInc] - sortedPts[i]

            HDImin = sortedPts[np.where(ciWidth == np.amin(ciWidth))[0]]
            HDImax = sortedPts[np.where(ciWidth == np.amin(ciWidth))[0] + ciIdxInc]
            HDIlim = (HDImin[0], HDImax[0])
        else:
            HDIlim = (min(sortedPts), max(sortedPts))

        return HDIlim

    # 封装本次评估的AB Test方法，并调用bayes_arpu和hdi_of_sample获取关键评估指标，返回结果报表
    # nameA 分组名称A
    # nameB 分组名称B
    # total_A A组样本量(一般是对照组)
    # success_A A组转化人数
    # rev_A A组转化金额/次数
    # total_B B组样本量（一般是实验组）
    # success_B B组转化人数
    # rev_B B组转化金额/次数

    def bayes_arpu_test(self, nameA, nameB, total_A, success_A, rev_A, total_B, success_B, rev_B):

        # 模拟分布的样本大小
        sim_sample = 100000
        if (success_A >= 0) & (total_A > 0) & (success_B >= 0) & (total_B >0) & (success_A <= total_A) & (success_B <= total_B) & (rev_A >= 0) & (rev_B >=0) :
            # 计算关键指标
            sample_A = total_A
            sample_B = total_B
            conv_A = success_A / total_A
            conv_B = success_B / total_B
            arppu_A = -1
            arppu_B = -1
            if success_A != 0:
                arppu_A = rev_A / success_A
            if success_B != 0 :
                arppu_B = rev_B / success_B
            arpu_A = rev_A / total_A
            arpu_B = rev_B / total_B
            alpha_A = success_A + 1
            alpha_B = success_B + 1
            beta_A = total_A - success_A + 1
            beta_B = total_B - success_B + 1
            k_A = success_A + 1
            k_B = success_B + 1
            theta_A = 1 / (1 + rev_A)
            theta_B = 1 / (1 + rev_B)

            # 获取bayesian-arpu-test结果
            res = self.bayes_arpu(
                alphaA=alpha_A, betaA=beta_A,
                kA=k_A, thetaA=theta_A,
                alphaB=alpha_B, betaB=beta_B,
                kB=k_B, thetaB=theta_B,
                MSamples=sim_sample
            )
            # print(res)

            # 计算95%置信度
            post_sample_A = res['sampleLambdaA'] / res['sampleOmegaA']
            post_sample_B = res['sampleLambdaB'] / res['sampleOmegaB']
            diff_post_sample = post_sample_B - post_sample_A
            hdi_A = self.hdi_of_sample(post_sample_A)
            hdi_B = self.hdi_of_sample(post_sample_B)
            hdi_diff = self.hdi_of_sample(diff_post_sample)

            result = {
                'sample size': {f'A-{nameA}': '{:d}'.format(sample_A),
                                f'B-{nameB}': '{:d}'.format(sample_B),
                                'B-A': ' '},
                'conversion': {f'A-{nameA}': '{:.3g}%'.format(conv_A * 100),
                               f'B-{nameB}': '{:.3g}%'.format(conv_B * 100),
                               'B-A': '{:.3g}%'.format(conv_B * 100 - conv_A * 100)},
                'ARPPU': {f'A-{nameA}': '{:.4g}'.format(arppu_A),
                          f'B-{nameB}': '{:.4g}'.format(arppu_B),
                          'B-A': '{:.4g}'.format(arppu_B - arppu_A)},
                'ARPU': {f'A-{nameA}': '{:.4g}'.format(arpu_A),
                         f'B-{nameB}': '{:.4g}'.format(arpu_B),
                         'B-A': '{:.4g}'.format(arpu_B - arpu_A)},
                'ARPU 95% 置信区间': {f'A-{nameA}': '[{:.3g},{:.3g}]'.format(hdi_A[0], hdi_A[1]),
                                  f'B-{nameB}': '[{:.3g},{:.3g}]'.format(hdi_B[0], hdi_B[1]),
                                  'B-A': '[{:.3g},{:.3g}]'.format(hdi_diff[0], hdi_diff[1])},
                'conProbBbeatsA': {'conversion': '{:.1f}'.format(res['convProbBbeatsA'] * 100),
                                   'ARPPU': '{:.1f}'.format(res['revProbBbeatsA'] * 100),
                                   'ARPU':'{:.1f}'.format(res['arpuProbBbeatsA'] * 100)},
                'conExpLossBOverABetter': {'conversion': '{:.2g}%'.format(res['convExpLossA'] * 100),
                                           'ARPPU': '{:.2g}'.format(res['revExpLossA']),
                                           'ARPU':'{:.2g}'.format(res['arpuExpLossA'])},
                'conExpLossBOverAWorse': {'conversion': '{:.2g}%'.format(res['convExpLossB'] * 100),
                                          'ARPPU': '{:.2g}'.format(res['revExpLossB']),
                                          'ARPU':'{:.2g}'.format(res['arpuExpLossB'])}
            }
            return result
        else:
            print(total_A, success_A, rev_A, total_B, success_B, rev_B)
            return {
                'sample size': {f'A-{nameA}': 'error：success or total or revenue',
                                f'B-{nameB}': 'error：success or total or revenue',
                                'B-A': ' '},
                'conversion': {f'A-{nameA}': 'error：success or total or revenue',
                               f'B-{nameB}': 'error：success or total or revenue',
                               'B-A': 'error：success or total or revenue'},
                'ARPPU': {f'A-{nameA}': 'error：success or total or revenue',
                          f'B-{nameB}': 'error：success or total or revenue',
                          'B-A': 'error：success or total or revenue'},
                'ARPU': {f'A-{nameA}': 'error：success or total or revenue',
                         f'B-{nameB}': 'error：success or total or revenue',
                         'B-A': 'error：success or total or revenue'},
                'ARPU 95% 置信区间': {f'A-{nameA}': 'error：success or total or revenue',
                                  f'B-{nameB}': 'error：success or total or revenue',
                                  'B-A': 'error：success or total or revenue'},
                'conProbBbeatsA': {'conversion': 'error：success or total or revenue',
                                   'ARPPU': 'error：success or total or revenue',
                                   'ARPU':'error：success or total or revenue'},
                'conExpLossBOverABetter': {'conversion': 'error：success or total or revenue',
                                           'ARPPU': 'error：success or total or revenue',
                                           'ARPU':'error：success or total or revenue'},
                'conExpLossBOverAWorse': {'conversion': 'error：success or total or revenue',
                                          'ARPPU': 'error：success or total or revenue',
                                          'ARPU':'error：success or total or revenue'}
            }

    # Bayesian AB test for conversion

    # Calculates the probability that B is better than A
    def prob_B_beats_A(self, alphaA, betaA, alphaB, betaB):
        if alphaA <= 0 | betaA <= 0 | alphaB <= 0 | betaB <= 0:
            result = 0
        else:
            result = 1
            for i in range(0, alphaA):
                result = result - math.exp(
                    betaln(alphaB + i, betaB + betaA) -
                    math.log(betaA + i) -
                    betaln(1 + i, betaA) -
                    betaln(alphaB, betaB)
                )
        return result

    # Calculates the loss function when choosing B over A
    def expected_loss_B_over_A(self, alphaA, betaA, alphaB, betaB):
        if alphaA <= 0 | betaA <= 0 | alphaB <= 0 | betaB <= 0:
            result = 0
        else:
            result = math.exp(
                betaln(alphaA + 1, betaA) - betaln(alphaA, betaA) +
                math.log(1 - self.prob_B_beats_A(alphaA + 1, betaA, alphaB, betaB))
            ) - math.exp(
                betaln(alphaB + 1, betaB) - betaln(alphaB, betaB) +
                math.log(1 - self.prob_B_beats_A(alphaA, betaA, alphaB + 1, betaB))
            )

        return result

    # Calculates the HDI interval from ICDF
    def get_hdi_of_icdf(self):
        return '''
             hdi_of_icdf <- function(ICDFname, credMass = 0.95, tol = 1e-8, ...) {
                incredMass <-  1 - credMass
                intervalWidth <- function(lowTailPr, ICDFname, credMass, ...) {
                  ICDFname(credMass + lowTailPr, ...) - ICDFname(lowTailPr, ...)
                }
                optInfo <- optimize(
                  intervalWidth,
                  c(0, incredMass),
                  ICDFname = ICDFname,
                  credMass = credMass,
                  tol = tol, ...
                )
                HDIlowTailPr <- optInfo$minimum
                return(
                  c(ICDFname(HDIlowTailPr, ...), ICDFname(credMass + HDIlowTailPr, ...))
                )
            }
        '''

    # Calculates the HDI interval from a sample of representative values
    def get_hdi_of_sample(self):
        return '''
             hdi_of_sample <- function(sampleVec, credMass = 0.95) {
               sortedPts <- sort(sampleVec)
               sortedPtsLength <- length(sortedPts)
               if(sortedPtsLength >= 3) {
                 ciIdxInc <- min(ceiling(credMass*sortedPtsLength), sortedPtsLength - 1)
                 nCIs <- sortedPtsLength - ciIdxInc
                 ciWidth <- rep(0, nCIs)
                 for (i in 1:nCIs) {
                   ciWidth[i] <- sortedPts[i + ciIdxInc] - sortedPts[i]
                 }
                 HDImin <- sortedPts[which.min(ciWidth)]
                 HDImax <- sortedPts[which.min(ciWidth) + ciIdxInc]
                 HDIlim <- c(HDImin, HDImax)
               } else {
                 HDIlim <- c(min(sortedPts), max(sortedPts))
               }
             }
        '''

    # Creates sample of difference of two beta distributions
    def get_create_sample_beta_diff(self):
        return '''
             create_sample_beta_diff <- function(alpha_A, beta_A, alpha_B, beta_B, size = 1e5) {
               if(
                 alpha_A >= 0 &&
                 beta_A >= 0 &&
                 alpha_B >= 0 &&
                 beta_B >= 0
               ) {
                 rbeta(size, alpha_B, beta_B) - rbeta(size, alpha_A, beta_A)
               } else 0
             }
        '''

    # 调用 bayes-conversion
    def bayes_conversion_test(self, nameA, nameB, total_A, success_A, total_B, success_B):
        if (success_A >= 0) & (total_A > 0) & (success_B >= 0) & (total_B > 0) & (success_A <= total_A) & (
                success_B <= total_B):
            sample_A = total_A
            sample_B = total_B
            conv_A = success_A / total_A
            conv_B = success_B / total_B
            alpha_A = success_A + 1
            alpha_B = success_B + 1
            beta_A = total_A - success_A + 1
            beta_B = total_B - success_B + 1
            robjects.r(self.get_hdi_of_icdf())
            hdi_A = robjects.r['hdi_of_icdf'](robjects.r('qbeta'), shape1=alpha_A, shape2=beta_A)
            hdi_B = robjects.r['hdi_of_icdf'](robjects.r('qbeta'), shape1=alpha_B, shape2=beta_B)
            robjects.r(self.get_create_sample_beta_diff())
            diff_post_sample = robjects.r['create_sample_beta_diff'](alpha_A, beta_A, alpha_B, beta_B, size=1e5)
            robjects.r(self.get_hdi_of_sample())
            hdi_diff = robjects.r['hdi_of_sample'](diff_post_sample)
            result = {
                'sample size': {f'A-{nameA}': sample_A, f'B-{nameB}': sample_B, 'B-A': ' '},
                'conversion': {f'A-{nameA}': '{:.3g}%'.format(conv_A * 100),
                               f'B-{nameB}': '{:.3g}%'.format(conv_B * 100),
                               'B-A': '{:.3g}%'.format(conv_B * 100 - conv_A * 100)},
                '95% HDI': {f'A-{nameA}': '[{:.3g}%,{:.3g}%]'.format(hdi_A[0] * 100, hdi_A[1] * 100),
                            f'B-{nameB}': '[{:.3g}%,{:.3g}%]'.format(hdi_B[0] * 100, hdi_B[1] * 100),
                            'B-A': '[{:.3g}%,{:.3g}%]'.format(hdi_diff[0] * 100, hdi_diff[1] * 100)},
                'conProbBbeatsA': '{:.1f}'.format(self.prob_B_beats_A(alpha_A, beta_A, alpha_B, beta_B) * 100)
                # ,
                # 'conExpLossBOverABetter': '{:.2g}%'.format(
                #     self.expected_loss_B_over_A(alpha_B, beta_B, alpha_A, beta_A) * 100),
                # 'conExpLossBOverAWorse': '{:.2g}%'.format(
                #     self.expected_loss_B_over_A(alpha_A, beta_A, alpha_B, beta_B) * 100)
            }
            return result
        else:
            return {
                'sample size': {f'A-{nameA}': 'success or total error', f'B-{nameB}': 'success or total error' ,'B-A': ' '},
                'conversion': {f'A-{nameA}': 'success or total error',
                               f'B-{nameB}': 'success or total error',
                               'B-A': 'success or total error'},
                '95% HDI': {f'A-{nameA}': 'success or total error',
                            f'B-{nameB}': 'success or total error',
                            'B-A': 'success or total error'},
                'conProbBbeatsA': 'success or total error',
                'conExpLossBOverABetter': 'success or total error',
                'conExpLossBOverAWorse': 'success or total error'
            }
