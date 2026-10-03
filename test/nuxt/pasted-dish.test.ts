import { describe, expect, it } from 'vitest'
import { readPastedDish } from '~/composables/useEating'

describe('a dish pasted from a label or a plan', () => {
  it('reads the name and the printed numbers, English labels', () => {
    const dish = readPastedDish('Overnight oats with banana\nKcal: 420, P: 18g, C: 65g, F: 9g')

    expect(dish).toEqual({
      title: 'Overnight oats with banana',
      stated: { kcal: 420, protein: 18, carbs: 65, fat: 9 },
      rest: ''
    })
  })

  it('reads Serbian labels, spelled out or abbreviated', () => {
    const short = readPastedDish('Pasulj prebranac\nkcal 520, P 24g, UH 61g, M 18g')
    const long = readPastedDish('Musaka\nKalorije: 610 | Proteini: 32 g | Ugljeni hidrati: 40 g | Masti: 35 g')

    expect(short.stated).toEqual({ kcal: 520, protein: 24, carbs: 61, fat: 18 })
    expect(long.stated).toEqual({ kcal: 610, protein: 32, carbs: 40, fat: 35 })
  })

  it('takes a decimal comma as a decimal, not as the next number', () => {
    const dish = readPastedDish('Smoothie\nKcal: 312,5, P: 18,5g, UH: 40,2g, M: 7,8g')

    expect(dish.stated).toEqual({ kcal: 312.5, protein: 18.5, carbs: 40.2, fat: 7.8 })
  })

  it('reads the number in front of its label as well as after it', () => {
    const dish = readPastedDish('Proteinska pločica\n210 kcal, 20 g protein, 18 g carbs, 7 g fat')

    expect(dish.stated).toEqual({ kcal: 210, protein: 20, carbs: 18, fat: 7 })
  })

  it('finds the numbers on any line and leaves the rest as ingredients', () => {
    const dish = readPastedDish([
      '  Kcal: 640, P: 45g, C: 70g, F: 18g ',
      '',
      'Piletina sa pirinčem',
      '200 g piletine',
      '100 g pirinča'
    ].join('\n'))

    expect(dish.title).toBe('Piletina sa pirinčem')
    expect(dish.stated?.kcal).toBe(640)
    expect(dish.rest).toBe('200 g piletine\n100 g pirinča')
  })

  it('does not mistake a word that starts like a label for one', () => {
    // "Porcija" starts with P and "Masline" with M — neither is a macro
    const dish = readPastedDish('Salata\nKcal: 180, Porcija 2, Masline 3, P: 4g')

    expect(dish.stated).toEqual({ kcal: 180, protein: 4, carbs: 0, fat: 0 })
  })

  it('counts a macro the label left out as zero', () => {
    expect(readPastedDish('Kafa\n35 kcal').stated).toEqual({ kcal: 35, protein: 0, carbs: 0, fat: 0 })
  })

  it('has no stated numbers without kcal on a line with digits', () => {
    expect(readPastedDish('Low kcal pancakes\n2 jaja\n50 g ovsenih').stated).toBeNull()
    expect(readPastedDish('Just a name').stated).toBeNull()
    expect(readPastedDish('Just a name').title).toBe('Just a name')
  })

  it('keeps a title to what the API accepts', () => {
    expect(readPastedDish('x'.repeat(300)).title).toHaveLength(160)
  })

  it('is empty for an empty paste', () => {
    expect(readPastedDish('\n \n')).toEqual({ title: '', stated: null, rest: '' })
  })

  // "Calories" is how most English labels and recipe sites print energy
  it('reads "Calories" as the energy line', () => {
    const dish = readPastedDish('Banana bread\nCalories: 420, Protein: 8g, Carbs: 60g, Fat: 16g')

    expect(dish.stated).toEqual({ kcal: 420, protein: 8, carbs: 60, fat: 16 })
    expect(dish.title).toBe('Banana bread')
  })

  it('reads "420 calories" and a single "Calorie" too, and still prefers kcal', () => {
    expect(readPastedDish('Toast\n420 calories, 8 g protein').stated?.kcal).toBe(420)
    expect(readPastedDish('Toast\nCalorie 95').stated?.kcal).toBe(95)
    expect(readPastedDish('Soup\nKcal: 210, calories from fat: 40').stated?.kcal).toBe(210)
  })
})
