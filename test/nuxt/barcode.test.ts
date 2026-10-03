import { describe, expect, it } from 'vitest'
import { checksumHolds } from '~/composables/useBarcodeScanner'

describe('a barcode only counts when its check digit adds up', () => {
  it('accepts real codes of every length a shop uses', () => {
    expect(checksumHolds('5449000000996', 'ean_13')).toBe(true) // a can of cola
    expect(checksumHolds('8600043003802', 'ean_13')).toBe(true)
    expect(checksumHolds('96385074', 'ean_8')).toBe(true)
    expect(checksumHolds('036000291452', 'upc_a')).toBe(true)
    expect(checksumHolds('00012345600012')).toBe(true) // GTIN-14 on an outer box
  })

  it('turns away a frame read mid-blur', () => {
    expect(checksumHolds('5449000000995', 'ean_13')).toBe(false)
    expect(checksumHolds('5449000000969', 'ean_13')).toBe(false) // two digits swapped
    expect(checksumHolds('96385075', 'ean_8')).toBe(false)
  })

  it('turns away lengths and characters no product code has', () => {
    for (const code of ['', '123', '1234567', '12345678901', '123456789012345', '54490000009a6', ' 5449000000996']) {
      expect(checksumHolds(code), code).toBe(false)
    }
  })

  it('leaves UPC-E to the decoder, which checks it itself', () => {
    expect(checksumHolds('01234565', 'upc_e')).toBe(true)
    expect(checksumHolds('0123456', 'UPCE')).toBe(true)
    expect(checksumHolds('012345', 'UPC-E')).toBe(true)
    expect(checksumHolds('01234', 'upc_e')).toBe(false)
    expect(checksumHolds('0123456a', 'upc_e')).toBe(false)
  })
})
