'use strict'

function ReportDispatcher({debug, knownIssueStatus}) {
    this.dispatch = ({caseRuns, resolveCaseIdsFromCaseRun, resolveTestRunsFromCasId}) => {

        // firstly group case runs by TestRail case id; one case run may relate to multiple TestRail cases
        let caseResults = {}
        for (let caseRun of caseRuns) {
            let caseRunResult = {
                statusId   : undefined,
                comment    : '',
                elapsed    : caseRun.time,
                defectsDict: {},
                testName   : caseRun.testName,
                railCaseIds: resolveCaseIdsFromCaseRun(caseRun.testClass, caseRun.testName),
            }

            if (caseRun.failures.length > 0) {
                // If test case failure elements exist, there was a failure. 5 means failure. Add failure messages
                caseRunResult.statusId = 5
                caseRunResult.comment  = caseRun.failures.join('\n')
            } else if (caseRun.skipped.length > 0) {
                caseRunResult.comment  = caseRun.skipped.join('\n')
                let mask = /([Kk]\/[Ii]|[Kk]nown issue): ([A-Z]{1}[A-Z0-9]+-\d+)/g
                let foundIssueIds = []
                    .concat((caseRunResult.testName.match(mask) || []).map(x => x.split(': ')[1]))
                    .concat((caseRunResult.comment.match(mask) || []).map(x => x.split(': ')[1]))
                if (foundIssueIds.length === 0) {
                    // if no issues found, skip the result
                    continue
                }
                caseRunResult.statusId = knownIssueStatus
                foundIssueIds.forEach(id => {caseRunResult.defectsDict[id] = true})
            } else {
                // Otherwise, the test case passed. 1 means pass.
                caseRunResult.statusId = 1
            }

            if (caseRunResult.statusId !== undefined) {
                debug('Result: ' + JSON.stringify(caseRunResult, undefined, 4))
                debug('Appending result to cases: ' + caseRunResult.railCaseIds)
                for (let caseId of caseRunResult.railCaseIds)  {
                    if (caseResults[caseId] === undefined) {
                        caseResults[caseId] = []
                    }
                    caseResults[caseId].push(caseRunResult)
                }
            }
        }

        // then for every found TestRail case summarize results and group by TestRail test run id
        let planResults = {}
        for (let caseId of Object.keys(caseResults)) {
            debug('caseId = ' + caseId)
            let caseSummary = {
                case_id  : caseId,
                status_id: 0,
                comment  : '',
                elapsed  : 0,
                defects  : '',
            }
            let defectsDict = {}
            for (let runResult of caseResults[caseId]) {
                debug('runResult: ' + JSON.stringify(runResult, undefined, 4))
                caseSummary.elapsed += runResult.elapsed
                if (runResult.statusId > caseSummary.status_id) {
                    caseSummary.status_id = runResult.statusId
                }
                if (runResult.comment !== '') {
                    caseSummary.comment += runResult.testName + ' (status ' + runResult.statusId + '): ' + runResult.comment + '\n'
                }
                Object.assign(defectsDict, runResult.defectsDict)
            }
            caseSummary.defects = Object.keys(defectsDict).join(',')
            if (caseSummary.elapsed === 0) {
                caseSummary.elapsed = 1
            }
            caseSummary.elapsed = '' + caseSummary.elapsed + 's'
            debug('caseSummary.elapsed = ' + caseSummary.elapsed)

            if (caseSummary.status_id === 0) {
                console.log('Case #' + caseId + ' result could not be defined')
                if (caseSummary.comment !== '') {
                    console.log(caseSummary.comment)
                }
                continue
            }

            let testRuns = resolveTestRunsFromCasId(caseId)
            debug('testRuns:')
            debug(testRuns)
            if (testRuns.length === 1) {
                let runId = testRuns[0]
                if (planResults[runId] === undefined) {
                    planResults[runId] = []
                }
                planResults[runId].push(caseSummary)
            } else {
                let testRunsStr = ''
                if (testRuns.length > 0) {
                    testRunsStr = '(' + testRuns + ') '
                }
                console.log('Case #' + caseId + ' is mentioned in ' + testRuns.length + ' TestRail test runs ' + testRunsStr + 'and thus its result is not reported')
            }
        }

        return planResults
    }
}

module.exports = ReportDispatcher