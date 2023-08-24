const {describe, it} = require('node:test')
const assert = require('node:assert/strict')

const {getStatisticValues} = require('./index')

describe('calculate statistic values', () => {
    it('should return null if you use invalid data (no array or array without numbers)', () => {
        assert.equal(getStatisticValues('string'),null)
        assert.equal(getStatisticValues({}),null)
        assert.equal(getStatisticValues([]),null)
        assert.equal(getStatisticValues(['a','b']),null)
        assert.equal(getStatisticValues([1,2,3,false]),null)
    })
    it('should calculate avg,min,max,median,sum', () => {
        assert.deepEqual(getStatisticValues([1,2,3]),{min:1, max:3, avg:2,median:2,sum:6})
        assert.deepEqual(getStatisticValues([1,2,3,6]),{min:1, max:6, avg:3,median:2.5,sum:12})
        assert.deepEqual(getStatisticValues([1,2.5,2.5,6]),{min:1, max:6, avg:3,median:2.5,sum:12})
        
    })

})