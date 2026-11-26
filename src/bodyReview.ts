import { addDays, weekOf } from './date'
import { hasCompletedSets, type BodyReviewMetrics, type State } from './store'

export function reviewSunday(today: string) {
  const sunday = weekOf(today)[6]
  return sunday <= today ? sunday : addDays(sunday, -7)
}

export function stepTargetOn(state: State, day: string) {
  const date = Object.keys(state.stepTargets ?? {}).filter(date => date <= day).sort().at(-1)
  return date ? state.stepTargets?.[date] : undefined
}

const mean = (values: number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : undefined

export function bodyReviewMetrics(state: State, sunday: string): BodyReviewMetrics {
  const days = Array.from({ length: 7 }, (_, index) => addDays(sunday, index - 7))
  const steps = days.flatMap(day => state.steps?.[day] ?? [])
  const weights = days.flatMap(day => state.weights?.[day] ?? [])
  const meals = days.map(day => state.food?.[day] ?? []).filter(items => items.length > 0)
  const calories = meals.map(items => items.reduce((sum, item) => sum + item.kcal, 0))
  const proteins = meals.filter(items => items.every(item => item.p != null))
    .map(items => items.reduce((sum, item) => sum + (item.p ?? 0), 0))
  const lifted = new Set((state.workouts ?? []).filter(workout =>
    days.includes(workout.day) && hasCompletedSets(workout)).map(workout => workout.day))
  return {
    stepDays: steps.length, averageSteps: mean(steps),
    weighInDays: weights.length, averageWeight: mean(weights), liftingDays: lifted.size,
    foodDays: calories.length, averageCalories: mean(calories), proteinDays: proteins.length, averageProtein: mean(proteins),
  }
}
