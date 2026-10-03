<script setup lang="ts">
import type { Food, Recipe } from '~/composables/useEating'
import {
  formatKcal,
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
/** The shelf could not be read — said as such, never as "no recipes yet" */
const recipesFailed = ref(false)
const recipeQuery = ref('')
// Each fetch is numbered: typing on, an older answer must not land over a newer one
let recipesAsked = 0

async function fetchRecipes() {
  const ask = (recipesAsked += 1)
  recipesLoading.value = true
  try {
    const found = await loadRecipes({ q: recipeQuery.value })
    if (ask === recipesAsked) {
      recipes.value = found
      recipesFailed.value = false
    }
  } catch {
    if (ask === recipesAsked) {
      recipesFailed.value = true
    }
  } finally {
    if (ask === recipesAsked) {
      recipesLoading.value = false
    }
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
useSheetHistory(newOpen)
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
const foodsFailed = ref(false)
const foodQuery = ref('')
const onlyMine = ref(false)
let foodsAsked = 0

async function fetchFoods() {
  const ask = (foodsAsked += 1)
  foodsLoading.value = true
  try {
    const found = await searchFoods(foodQuery.value, 200, onlyMine.value)
    if (ask === foodsAsked) {
      foods.value = found
      foodsFailed.value = false
    }
  } catch {
    if (ask === foodsAsked) {
      foodsFailed.value = true
    }
  } finally {
    if (ask === foodsAsked) {
      foodsLoading.value = false
    }
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

/** The "+" in the bar adds to whichever shelf is showing */
function addNew() {
  if (tab.value === 'recipes') {
    newOpen.value = true
  } else {
    openFood(null)
  }
}

const TABS: { value: Tab, label: string, icon: string }[] = [
  { value: 'recipes', label: 'Recipes', icon: 'i-lucide-book-open' },
  { value: 'foods', label: 'Foods', icon: 'i-lucide-apple' }
]
</script>

<template>
  <AppPage
    title="Library"
    eyebrow=""
  >
    <template #actions>
      <UButton
        icon="i-lucide-plus"
        variant="ghost"
        square
        :aria-label="tab === 'recipes' ? 'New recipe' : 'New food'"
        :ui="{ leadingIcon: 'size-6' }"
        @click="addNew"
      />
    </template>

    <template #toolbar>
      <div class="flex flex-col gap-2.5">
        <ShellSegmented
          v-model="tab"
          label="Shelf"
          :options="TABS"
        />

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
          <button
            type="button"
            class="app-chip h-11"
            :aria-pressed="onlyMine"
            @click="onlyMine = !onlyMine"
          >
            <UIcon
              name="i-lucide-user-round"
              class="size-4"
            />
            Mine
          </button>
        </div>
      </div>
    </template>

    <!-- RECIPES -->
    <ShellSection
      v-if="tab === 'recipes'"
      :title="recipes.length ? `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}` : 'Recipes'"
    >
      <template
        v-if="recipes.length && !recipesFailed"
        #actions
      >
        <span class="app-group-title">kcal · the whole dish</span>
      </template>
      <ShellCard
        flush
        :loading="recipesLoading"
        :is-empty="!recipes.length || recipesFailed"
      >
        <template #empty>
          <ShellEmpty
            v-if="recipesFailed"
            compact
            icon="i-lucide-wifi-off"
            title="Your recipes didn't load"
            description="Nothing is lost — check the connection and try again."
          >
            <UButton
              label="Try again"
              size="sm"
              variant="soft"
              :loading="recipesLoading"
              @click="fetchRecipes"
            />
          </ShellEmpty>
          <ShellEmpty
            v-else-if="recipeQuery"
            compact
            icon="i-lucide-search-x"
            title="No recipe by that name"
            description="Try another word from it."
          />
          <ShellEmpty
            v-else
            icon="i-lucide-chef-hat"
            title="No recipes yet"
            description="A name is enough — or paste a dish with its numbers, and it can go on any day."
          >
            <UButton
              label="New recipe"
              icon="i-lucide-plus"
              @click="newOpen = true"
            />
          </ShellEmpty>
        </template>

        <button
          v-for="recipe in recipes"
          :key="recipe.id"
          type="button"
          class="flex min-h-14 w-full items-center gap-3 py-2.5 pr-3 pl-4 text-left outline-none transition-colors duration-120 ease-soft focus-visible:bg-elevated active:bg-accented motion-reduce:transition-none"
          @click="show(recipe)"
        >
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="line-clamp-2 text-body break-words text-highlighted">{{ recipe.title }}</span>
            <span class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span class="text-footnote text-muted tabular-nums">
                <template v-if="recipe.minutes">{{ recipe.minutes }} min · </template>{{ servingsLabel(recipe) }}
              </span>
              <ShellMacroLine
                v-if="recipe.items.length"
                :macros="recipe"
                :kcal="false"
              />
              <span
                v-else-if="recipe.stated"
                class="text-footnote text-muted"
              >as stated</span>
              <span
                v-if="statedGap(recipe) && recipe.stated"
                class="text-footnote font-medium text-warning tabular-nums"
              >stated {{ formatKcal(recipe.stated.kcal) }}</span>
            </span>
          </span>
          <span class="flex w-16 shrink-0 flex-col items-end leading-tight tabular-nums">
            <span class="text-body font-medium text-highlighted">{{ formatKcal(kcalOf(recipe)) }}</span>
            <span
              v-if="recipe.servings > 1 && perServing(recipe) && recipe.items.length"
              class="text-caption2 text-muted"
            >{{ formatKcal(perServing(recipe)!.kcal) }} each</span>
            <span
              v-else
              class="text-caption2 text-muted"
            >kcal</span>
          </span>
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4.5 shrink-0 text-dimmed"
          />
        </button>
      </ShellCard>
    </ShellSection>

    <!-- FOODS -->
    <ShellSection
      v-else
      :title="foods.length ? `${foods.length} ${foods.length === 1 ? 'food' : 'foods'}` : 'Foods'"
    >
      <template
        v-if="foods.length && !foodsFailed"
        #actions
      >
        <span class="app-group-title">kcal · per 100 g or ml</span>
      </template>
      <ShellCard
        flush
        :loading="foodsLoading"
        :is-empty="!foods.length || foodsFailed"
      >
        <template #empty>
          <ShellEmpty
            v-if="foodsFailed"
            compact
            icon="i-lucide-wifi-off"
            title="The foods didn't load"
            description="Nothing is lost — check the connection and try again."
          >
            <UButton
              label="Try again"
              size="sm"
              variant="soft"
              :loading="foodsLoading"
              @click="fetchFoods"
            />
          </ShellEmpty>
          <ShellEmpty
            v-else-if="onlyMine"
            icon="i-lucide-scan-barcode"
            title="None of your own yet"
            description="Scan a packet from the + button, or add a food by hand — it is yours from then on."
          >
            <UButton
              label="Add food"
              icon="i-lucide-plus"
              @click="openFood(null)"
            />
          </ShellEmpty>
          <ShellEmpty
            v-else
            compact
            icon="i-lucide-search-x"
            title="No foods match"
            description="Add it once and it is yours."
          >
            <UButton
              label="Add"
              icon="i-lucide-plus"
              size="sm"
              variant="soft"
              @click="openFood(null)"
            />
          </ShellEmpty>
        </template>

        <TransitionGroup
          tag="div"
          name="list"
          class="app-divide flex flex-col"
        >
          <FoodRow
            v-for="food in foods"
            :key="food.id"
            :food="food"
            @pick="openFood"
            @star="toggleStar"
          />
        </TransitionGroup>
      </ShellCard>
    </ShellSection>

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
        <ul class="mt-3 flex flex-col gap-1.5 px-1 text-footnote text-muted">
          <li class="flex gap-2">
            <span class="mt-1.5 size-1 shrink-0 rounded-full bg-(--ui-text-dimmed)" />
            The first line is the name.
          </li>
          <li class="flex gap-2">
            <span class="mt-1.5 size-1 shrink-0 rounded-full bg-(--ui-text-dimmed)" />
            A line with kcal is taken as the dish's stated numbers.
          </li>
          <li class="flex gap-2">
            <span class="mt-1.5 size-1 shrink-0 rounded-full bg-(--ui-text-dimmed)" />
            Anything after that is read as ingredients.
          </li>
        </ul>
      </template>
      <template #footer>
        <div class="flex w-full gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            size="lg"
            :disabled="creating"
            @click="newOpen = false"
          />
          <UButton
            label="Create"
            size="lg"
            class="flex-1 justify-center"
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
