<script setup lang="ts">
import type { Food, Recipe } from '~/composables/useEating'
import {
  formatKcal,
  formatMacro,
  perServing,
  readPastedDish,
  servingsLabel,
  statedGap
} from '~/composables/useEating'

/**
 * The two shelves behind the diary: your recipes, and the pantry of foods
 * with what 100 g of each is worth — the shared staples plus your own.
 *
 * Food names stay exactly as the data holds them; the app's own words are English.
 */
const { loadRecipes, createRecipe, updateRecipe, parseText, searchFoods, setFavourite } = useEating()
const toast = useToast()
const route = useRoute()

type Tab = 'recipes' | 'foods'
const tab = ref<Tab>(route.query.tab === 'foods' ? 'foods' : 'recipes')

watch(tab, (value) => {
  void navigateTo({ query: value === 'foods' ? { tab: 'foods' } : {} }, { replace: true })
})

onMounted(async () => {
  await Promise.all([fetchRecipes(), fetchFoods()])
})

function fail(error: unknown) {
  toast.add({ title: apiErrorMessage(error), icon: 'i-lucide-circle-alert', color: 'error' })
}

// --- Recipes ----------------------------------------------------------------------

const recipes = ref<Recipe[]>([])
const recipesLoading = ref(false)
const recipeQuery = ref('')

async function fetchRecipes() {
  recipesLoading.value = true
  try {
    recipes.value = await loadRecipes({ q: recipeQuery.value })
  } catch {
    recipes.value = []
  } finally {
    recipesLoading.value = false
  }
}

let recipeTimer: ReturnType<typeof setTimeout> | null = null
watch(recipeQuery, () => {
  if (recipeTimer) {
    clearTimeout(recipeTimer)
  }
  recipeTimer = setTimeout(() => void fetchRecipes(), 250)
})

const openRecipe = ref<Recipe | null>(null)
const recipeOpen = ref(false)

function show(recipe: Recipe) {
  openRecipe.value = recipe
  recipeOpen.value = true
}

function onRecipeSaved(saved: Recipe) {
  recipes.value = recipes.value.map(row => (row.id === saved.id ? saved : row))
  openRecipe.value = saved
}

function onRecipeRemoved(removed: Recipe) {
  recipes.value = recipes.value.filter(row => row.id !== removed.id)
}

/** What a recipe comes to — its stated numbers when it has no ingredients yet */
function kcalOf(recipe: Recipe): number {
  return !recipe.items.length && recipe.stated ? recipe.stated.kcal : recipe.kcal
}

/** A recipe of one's own starts as a title — the rest is filled in the panel */
const newOpen = ref(false)
const newTitle = ref('')
const creating = ref(false)

/**
 * A new recipe can be a name, or a whole dish copied off a label or a plan:
 *
 *   Overnight oats with banana
 *   Kcal: 420, P: 18g, C: 65g, F: 9g
 *
 * The name, the numbers that were printed, and — if more lines follow — the
 * ingredients, all in one paste. A dish known only by its numbers is a real
 * recipe here: it can be put on a day and it counts.
 */
async function create() {
  const dish = readPastedDish(newTitle.value)
  if (!dish.title || creating.value) {
    return
  }
  creating.value = true
  try {
    let created = await createRecipe({ title: dish.title, stated: dish.stated })

    if (dish.rest.trim()) {
      const { items, unknown } = await parseText(dish.rest)
      if (items.length) {
        created = await updateRecipe(created.id, {
          items: items.map(item => ({
            food_id: item.food_id,
            label: item.label,
            quantity: item.quantity,
            unit: item.unit,
            optional: false
          }))
        })
      }
      if (unknown.length) {
        toast.add({
          title: `${unknown.length} ${unknown.length === 1 ? 'line' : 'lines'} had no food`,
          description: unknown.join(', '),
          icon: 'i-lucide-triangle-alert',
          color: 'warning'
        })
      }
    }

    recipes.value = [created, ...recipes.value]
    newOpen.value = false
    newTitle.value = ''
    show(created)
  } catch (error) {
    fail(error)
  } finally {
    creating.value = false
  }
}

// --- Foods --------------------------------------------------------------------------

const foods = ref<Food[]>([])
const foodsLoading = ref(false)
const foodQuery = ref('')
const onlyMine = ref(false)

async function fetchFoods() {
  foodsLoading.value = true
  try {
    foods.value = await searchFoods(foodQuery.value, 200, onlyMine.value)
  } catch {
    foods.value = []
  } finally {
    foodsLoading.value = false
  }
}

let foodTimer: ReturnType<typeof setTimeout> | null = null
watch(foodQuery, () => {
  if (foodTimer) {
    clearTimeout(foodTimer)
  }
  foodTimer = setTimeout(() => void fetchFoods(), 250)
})
watch(onlyMine, () => void fetchFoods())

const foodFormOpen = ref(false)
const editingFood = ref<Food | null>(null)
const templateFood = ref<Food | null>(null)

/** Your own food opens to be edited; a shared one opens your own version of it */
function openFood(food: Food | null) {
  editingFood.value = food?.mine ? food : null
  templateFood.value = food && !food.mine ? food : null
  foodFormOpen.value = true
}

function onFoodSaved(saved: Food) {
  const known = foods.value.some(row => row.id === saved.id)
  foods.value = known
    ? foods.value.map(row => (row.id === saved.id ? saved : row))
    : [saved, ...foods.value]
}

function onFoodRemoved(removed: Food) {
  foods.value = foods.value.filter(row => row.id !== removed.id)
}

/** Starred foods come first whenever food is added */
async function toggleStar(food: Food) {
  const next = !food.favourite
  food.favourite = next
  try {
    await setFavourite(food.id, next)
  } catch (error) {
    food.favourite = !next
    fail(error)
  }
}

const SEGMENT = 'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors'
const SEGMENT_ON = 'bg-default text-highlighted shadow-sm'
const SEGMENT_OFF = 'text-muted hover:text-default'
</script>

<template>
  <AppPage title="Library">
    <template #actions>
      <UButton
        v-if="tab === 'recipes'"
        label="Recipe"
        icon="i-lucide-plus"
        size="sm"
        @click="newOpen = true"
      />
      <UButton
        v-else
        label="Food"
        icon="i-lucide-plus"
        size="sm"
        @click="openFood(null)"
      />
    </template>

    <template #toolbar>
      <div class="flex flex-col gap-2">
        <div
          class="flex items-center gap-0.5 rounded-xl bg-elevated/70 p-0.5"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'recipes'"
            :class="[SEGMENT, tab === 'recipes' ? SEGMENT_ON : SEGMENT_OFF]"
            @click="tab = 'recipes'"
          >
            <UIcon
              name="i-lucide-book-open"
              class="size-3.5"
            />
            Recipes
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'foods'"
            :class="[SEGMENT, tab === 'foods' ? SEGMENT_ON : SEGMENT_OFF]"
            @click="tab = 'foods'"
          >
            <UIcon
              name="i-lucide-carrot"
              class="size-3.5"
            />
            Foods
          </button>
        </div>

        <UInput
          v-if="tab === 'recipes'"
          v-model="recipeQuery"
          icon="i-lucide-search"
          placeholder="Search your recipes…"
          class="w-full"
        />
        <div
          v-else
          class="flex items-center gap-2"
        >
          <UInput
            v-model="foodQuery"
            icon="i-lucide-search"
            placeholder="Search foods…"
            class="min-w-0 flex-1"
          />
          <USwitch
            v-model="onlyMine"
            label="Mine"
          />
        </div>
      </div>
    </template>

    <!-- RECIPES -->
    <SheetCard
      v-if="tab === 'recipes'"
      title="Recipes"
      icon="i-lucide-book-open"
      :count="recipes.length || null"
      hint="the whole dish"
      :loading="recipesLoading"
      :is-empty="!recipes.length"
      :empty="recipeQuery ? 'No recipe by that name.' : 'No recipes yet — write the first one: a name is enough, or paste a dish with its numbers.'"
    >
      <button
        v-for="recipe in recipes"
        :key="recipe.id"
        type="button"
        class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-elevated/60"
        @click="show(recipe)"
      >
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-sm font-medium text-highlighted">{{ recipe.title }}</span>
          <span class="flex min-w-0 flex-wrap gap-x-2 text-[11px] tabular-nums">
            <span class="text-dimmed">
              <template v-if="recipe.minutes">{{ recipe.minutes }} min · </template>{{ servingsLabel(recipe) }}
            </span>
            <span class="text-sky-500">P {{ formatMacro(recipe.protein) }}</span>
            <span class="text-violet-500">C {{ formatMacro(recipe.carbs) }}</span>
            <span class="text-amber-500">F {{ formatMacro(recipe.fat) }}</span>
            <span
              v-if="statedGap(recipe) && recipe.stated"
              class="text-warning"
            >stated {{ formatKcal(recipe.stated.kcal) }}</span>
          </span>
        </span>
        <span class="shrink-0 text-right tabular-nums">
          <span class="block text-sm font-medium text-highlighted">{{ formatKcal(kcalOf(recipe)) }}</span>
          <span
            v-if="recipe.servings > 1 && perServing(recipe) && recipe.items.length"
            class="block text-[10px] text-dimmed"
          >{{ formatKcal(perServing(recipe)!.kcal) }} each</span>
        </span>
        <UIcon
          name="i-lucide-chevron-right"
          class="size-4 shrink-0 text-dimmed"
        />
      </button>
    </SheetCard>

    <!-- FOODS -->
    <SheetCard
      v-else
      title="Foods"
      icon="i-lucide-carrot"
      :count="foods.length || null"
      hint="per 100 g or ml"
      :loading="foodsLoading"
      :is-empty="!foods.length"
      :empty="onlyMine ? 'You haven\'t added any foods yet — scan a packet or add one by hand.' : 'No foods match — add one and it is yours from then on.'"
    >
      <TransitionGroup name="list">
        <FoodRow
          v-for="food in foods"
          :key="food.id"
          :food="food"
          @pick="openFood"
          @star="toggleStar"
        />
      </TransitionGroup>
    </SheetCard>

    <!-- A recipe of one's own: a name, or a dish copied off a label -->
    <UDrawer
      v-model:open="newOpen"
      :ui="SHEET_UI"
      title="New recipe"
      description="A name is enough — or paste the dish as it is written, numbers and all."
    >
      <template #body>
        <UTextarea
          v-model="newTitle"
          :rows="3"
          autoresize
          autofocus
          class="w-full"
          placeholder="Overnight oats with banana&#10;Kcal: 420, P: 18g, C: 65g, F: 9g"
          @keydown.meta.enter.prevent="create"
          @keydown.ctrl.enter.prevent="create"
        />
        <p class="mt-2 text-xs text-dimmed">
          The first line is the name. A line with kcal is taken as the dish's
          stated numbers. Anything after that is read as ingredients.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            :disabled="creating"
            @click="newOpen = false"
          />
          <UButton
            label="Create"
            :loading="creating"
            :disabled="!newTitle.trim()"
            @click="create"
          />
        </div>
      </template>
    </UDrawer>

    <RecipeModal
      v-model:open="recipeOpen"
      :recipe="openRecipe"
      @saved="onRecipeSaved"
      @removed="onRecipeRemoved"
    />

    <FoodForm
      v-model:open="foodFormOpen"
      :food="editingFood"
      :template="templateFood"
      @saved="onFoodSaved"
      @removed="onFoodRemoved"
    />
  </AppPage>
</template>
