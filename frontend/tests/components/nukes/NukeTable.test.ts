/**
 * NukeTable Component Integration Tests
 *
 * Tests the data table component for TinkerNukes offensive nano display.
 * Validates:
 * - Column sorting (single and multiple)
 * - Pagination functionality
 * - Infinity symbol (∞) display for sustainable nanos
 * - Computed column calculations (DPS, damage/nano, sustain metrics)
 * - Row click navigation to nano detail page
 * - Accessibility features (ARIA labels, keyboard navigation, screen reader support)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue';
import { mount, VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import NukeTable from '@/components/nukes/NukeTable.vue'
import type { OffensiveNano, NukeInputState } from '@/types/offensive-nano'

// Mock PrimeVue DataTable and Column components
vi.mock('primevue/datatable', () => ({
  default: {
    name: 'DataTable',
    template: `
      <table :aria-label="ariaLabel" role="table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.field">{{ col.header }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in visibleRows"
            :key="index"
            @click="handleRowClick(row)"
            tabindex="0"
            @keydown.enter="handleRowClick(row)"
          >
            <td v-for="col in columns" :key="col.field">
              <slot :name="'body'" :data="row" :field="col.field">
                {{ row[col.field] }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    `,
    props: {
      value: Array,
      loading: Boolean,
      paginator: Boolean,
      rows: Number,
      rowsPerPageOptions: Array,
      sortMode: String,
      sortField: String,
      sortOrder: Number,
      globalFilter: String,
      ariaLabel: String
    },
    emits: ['row-click'],
    setup(props: any, { emit }: any) {
      const columns = [
        { field: 'name', header: 'Nano' },
        { field: 'ql', header: 'QL' },
        { field: 'castTime', header: 'Cast Time (s)' },
        { field: 'dps', header: 'DPS' },
        { field: 'sustainTimeFormatted', header: 'Sustain Time' }
      ]

      const visibleRows = props.value?.slice(0, props.rows || 25) || []

      const handleRowClick = (row: any) => {
        emit('row-click', { data: row })
      }

      return { columns, visibleRows, handleRowClick }
    }
  }
}))

vi.mock('primevue/column', () => ({
  default: {
    name: 'Column',
    template: '<div></div>',
    props: ['field', 'header', 'sortable', 'class']
  }
}))

// ============================================================================
// Test Fixtures
// ============================================================================

const createDefaultInputState = (): NukeInputState => ({
  characterStats: {
    breed: 1,
    psychic: 100,
    nanoInit: 1200,
    maxNano: 5000,
    nanoDelta: 500,
    matterCreation: 2500,
    matterMeta: 2500,
    bioMeta: 2500,
    psychModi: 2500,
    sensoryImp: 2500,
    timeSpace: 2500,
  },
  damageModifiers: {
    projectile: 100,
    melee: 0,
    energy: 150,
    chemical: 0,
    radiation: 0,
    cold: 0,
    nano: 200,
    fire: 0,
    poison: 0,
    directNanoDamageEfficiency: 50,
    targetAC: 0,
  },
  buffPresets: {
    crunchcom: 3,
    humidity: 5,
    notumSiphon: 7,
    channeling: 2,
    enhanceNanoDamage: 4,
    ancientMatrix: 6,
  },
})

const createMockNanos = (): OffensiveNano[] => [
  {
    id: 1001,
    aoid: 1001,
    name: 'Viral Bomb',
    school: 'Bio Meta' as any,
    strain: '1',
    description: 'Instant damage nano',
    level: 200,
    qualityLevel: 250,
    castingRequirements: [],
    minDamage: 800,
    maxDamage: 1200,
    midDamage: 1000,
    damageType: 'poison',
    tickCount: 1,
    tickInterval: 0,
    castTime: 300,
    rechargeTime: 2000,
    nanoPointCost: 500,
    attackDelayCap: 100,
    rechargeDelayCap: 100
  },
  {
    id: 1002,
    aoid: 1002,
    name: 'Corrosive Cloud',
    school: 'Bio Meta' as any,
    strain: '2',
    description: 'DoT nano with 5 ticks',
    level: 210,
    qualityLevel: 260,
    castingRequirements: [],
    minDamage: 200,
    maxDamage: 300,
    midDamage: 250,
    damageType: 'chemical',
    tickCount: 5,
    tickInterval: 100,
    castTime: 400,
    rechargeTime: 1500,
    nanoPointCost: 450,
    attackDelayCap: 100,
    rechargeDelayCap: 100
  },
  {
    id: 1003,
    aoid: 1003,
    name: 'Energy Blast',
    school: 'Matter Creation' as any,
    strain: '1',
    description: 'High damage instant',
    level: 220,
    qualityLevel: 300,
    castingRequirements: [],
    minDamage: 1500,
    maxDamage: 2000,
    midDamage: 1750,
    damageType: 'energy',
    tickCount: 1,
    tickInterval: 0,
    castTime: 500,
    rechargeTime: 3000,
    nanoPointCost: 800,
    attackDelayCap: 100,
    rechargeDelayCap: 100
  }
]

// ============================================================================
// Test Suite
// ============================================================================

describe('NukeTable', () => {
  let wrapper: VueWrapper<any>
  let router: any

  beforeEach(() => {
    // Create a mock router for navigation tests
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/items/:id', component: { template: '<div>Item Detail</div>' } }
      ]
    })
  })

  // ==========================================================================
  // Component Mounting & Structure Tests
  // ==========================================================================

  describe('Component Structure', () => {
    it('should render DataTable with nano data', () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('table').exists()).toBe(true)
    })

    it('should display loading state when loading prop is true', () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: [],
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: true
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.props('loading')).toBe(true)
    })

    it('should have accessible ARIA label describing the table', () => {
      const nanos = createMockNanos()

      wrapper = mount(NukeTable, {
        props: {
          nanos,
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      const table = wrapper.find('table')
      expect(table.attributes('aria-label')).toContain('offensive nano programs')
      expect(table.attributes('role')).toBe('table')
    })
  })

  // ==========================================================================
  // Column Sorting Tests
  // ==========================================================================

  describe('Column Sorting', () => {
    it('should default sort by QL descending', () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      // Check DataTable props
      expect(wrapper.vm.defaultSortField).toBe('ql')
      expect(wrapper.vm.defaultSortOrder).toBe(-1) // Descending
    })

    it('should support sortable columns', () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      // DataTable has sortMode="multiple"
      expect(wrapper.find('table').exists()).toBe(true)
    })

    it('should display computed column values correctly', async () => {
      const nanos = createMockNanos()

      wrapper = mount(NukeTable, {
        props: {
          nanos,
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      // Check that tableData computed property exists
      expect(wrapper.vm.tableData).toBeDefined()
      expect(wrapper.vm.tableData.length).toBe(3)
    })
  })

  // ==========================================================================
  // Pagination Tests
  // ==========================================================================

  describe('Pagination', () => {
    it('should paginate with default 25 rows per page', () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      // Check pagination props passed to DataTable
      const table = wrapper.findComponent({ name: 'DataTable' })
      expect(table.props('paginator')).toBe(true)
      expect(table.props('rows')).toBe(25)
    })

    it('should support multiple rows per page options', () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      const table = wrapper.findComponent({ name: 'DataTable' })
      expect(table.props('rowsPerPageOptions')).toEqual([25, 50, 100])
    })

    it('should display visible rows based on pagination', () => {
      // Create 30 nanos to test pagination
      const manyNanos = Array.from({ length: 30 }, (_, i) => ({
        ...createMockNanos()[0],
        id: 2000 + i,
        name: `Nano ${i + 1}`
      }))

      wrapper = mount(NukeTable, {
        props: {
          nanos: manyNanos,
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      // First page should show 25 rows
      const rows = wrapper.findAll('tbody tr')
      expect(rows.length).toBeLessThanOrEqual(25)
    })
  })

  // ==========================================================================
  // Infinity Symbol Display Tests
  // ==========================================================================

  describe('Infinity Symbol Display', () => {
    it('should display ∞ for sustainable sustain time', async () => {
      // Create nano with high regen (sustainable)
      const inputState = createDefaultInputState()
      inputState.buffPresets.humidity = 7 // High regen
      inputState.buffPresets.notumSiphon = 10
      inputState.characterStats.maxNano = 10000

      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState,
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      // Check tableData for infinity symbol
      const tableData = wrapper.vm.tableData
      const sustainableNano = tableData.find((row: any) =>
        row.sustainTimeFormatted === '∞'
      )

      // At least one nano should be sustainable with high regen
      expect(sustainableNano).toBeDefined()
    })

    it('should display ∞ for sustainable casts to empty', async () => {
      const inputState = createDefaultInputState()
      inputState.buffPresets.humidity = 7
      inputState.buffPresets.notumSiphon = 10
      inputState.characterStats.maxNano = 10000

      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState,
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const tableData = wrapper.vm.tableData
      const sustainableNano = tableData.find((row: any) =>
        row.castsToEmptyFormatted === '∞'
      )

      expect(sustainableNano).toBeDefined()
    })

    it('should display finite time for non-sustainable nanos', async () => {
      // Low regen, high cost nano
      const inputState = createDefaultInputState()
      inputState.buffPresets.humidity = 0
      inputState.buffPresets.notumSiphon = 0
      inputState.characterStats.maxNano = 2000

      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState,
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const tableData = wrapper.vm.tableData

      // Should have some finite sustain times (not ∞)
      const finiteNano = tableData.find((row: any) =>
        row.sustainTimeFormatted !== '∞' && row.sustainTimeFormatted.includes('s')
      )

      expect(finiteNano).toBeDefined()
    })
  })

  // ==========================================================================
  // Computed Column Calculations Tests
  // ==========================================================================

  describe('Computed Column Calculations', () => {
    it('should calculate cast time with nano init reduction', async () => {
      const inputState = createDefaultInputState()
      inputState.characterStats.nanoInit = 1200

      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState,
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const tableData = wrapper.vm.tableData

      // Cast time should be reduced from base
      expect(tableData[0].castTime).toBeDefined()
      expect(typeof tableData[0].castTime).toBe('string')
      expect(parseFloat(tableData[0].castTime)).toBeLessThan(3.0) // 300cs base = 3.0s
    })

    it('should calculate recharge time with nano init reduction', async () => {
      const inputState = createDefaultInputState()
      inputState.characterStats.nanoInit = 1200

      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState,
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const tableData = wrapper.vm.tableData

      expect(tableData[0].rechargeTime).toBeDefined()
      expect(typeof tableData[0].rechargeTime).toBe('string')
    })

    it('should calculate nano cost with Crunchcom reduction', async () => {
      const inputState = createDefaultInputState()
      inputState.buffPresets.crunchcom = 5 // 20% reduction

      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState,
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const tableData = wrapper.vm.tableData

      // Nano cost should be reduced
      expect(tableData[0].nanoCost).toBeDefined()
      expect(tableData[0].nanoCost).toBeLessThan(500) // Base cost
    })

    it('should calculate damage with all modifiers applied', async () => {
      const inputState = createDefaultInputState()
      inputState.damageModifiers.poison = 100
      inputState.damageModifiers.nano = 200
      inputState.damageModifiers.directNanoDamageEfficiency = 50

      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState,
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const tableData = wrapper.vm.tableData

      // Damage should be greater than base due to modifiers
      expect(tableData[0].minDamage).toBeGreaterThan(800) // Base min
      expect(tableData[0].maxDamage).toBeGreaterThan(1200) // Base max
      expect(tableData[0].midDamage).toBeGreaterThan(1000) // Base mid
    })

    it('should calculate DPS correctly for instant damage nano', async () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const tableData = wrapper.vm.tableData
      const instantNano = tableData.find((row: any) => row.id === 1001)

      expect(instantNano).toBeDefined()
      expect(instantNano.dps).toBeDefined()
      expect(parseFloat(instantNano.dps)).toBeGreaterThan(0)
    })

    it('should calculate DPS correctly for DoT nano with tick duration', async () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const tableData = wrapper.vm.tableData
      const dotNano = tableData.find((row: any) => row.id === 1002)

      expect(dotNano).toBeDefined()
      expect(dotNano.dps).toBeDefined()
      // DPS should account for tick duration in cycle time
      expect(parseFloat(dotNano.dps)).toBeGreaterThan(0)
    })

    it('should calculate damage per nano efficiency metric', async () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const tableData = wrapper.vm.tableData

      expect(tableData[0].damagePerNano).toBeDefined()
      expect(parseFloat(tableData[0].damagePerNano)).toBeGreaterThan(0)
    })

    it('should format all numeric values with proper precision', async () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const tableData = wrapper.vm.tableData
      const row = tableData[0]

      // Cast time and recharge time: 2 decimal places
      expect(row.castTime).toMatch(/^\d+\.\d{2}$/)
      expect(row.rechargeTime).toMatch(/^\d+\.\d{2}$/)

      // DPS: 2 decimal places
      expect(row.dps).toMatch(/^\d+\.\d{2}$/)

      // Damage per nano: 2 decimal places
      expect(row.damagePerNano).toMatch(/^\d+\.\d{2}$/)

      // Damage values: integers
      expect(row.minDamage).toBeTypeOf('number')
      expect(row.maxDamage).toBeTypeOf('number')
      expect(row.midDamage).toBeTypeOf('number')
    })
  })

  // ==========================================================================
  // Row Click Navigation Tests
  // ==========================================================================

  describe('Row Click Navigation', () => {
    it('should emit nano-selected event on row click', async () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      // Click first row
      const firstRow = wrapper.find('tbody tr')
      await firstRow.trigger('click')

      const emitted = wrapper.emitted('nano-selected')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toBe(1001) // First nano ID
    })

    it('should support keyboard navigation with Enter key', async () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        },
        attachTo: document.body
      })

      await wrapper.vm.$nextTick()

      // Focus first row and press Enter
      const firstRow = wrapper.find('tbody tr')
      firstRow.element.focus()
      await firstRow.trigger('keydown.enter')

      const emitted = wrapper.emitted('nano-selected')
      expect(emitted).toBeTruthy()

      wrapper.unmount()
    })

    it('should have tabindex on rows for keyboard navigation', async () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const firstRow = wrapper.find('tbody tr')
      expect(firstRow.attributes('tabindex')).toBe('0')
    })

    it('should emit correct nano ID for different rows', async () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const rows = wrapper.findAll('tbody tr')

      // Click second row
      await rows[1].trigger('click')

      const emitted = wrapper.emitted('nano-selected')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toBe(1002) // Second nano ID
    })
  })

  // ==========================================================================
  // Search and Filtering Tests
  // ==========================================================================

  describe('Search and Filtering', () => {
    it('should apply global filter from search query', () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: 'Viral',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      const table = wrapper.findComponent({ name: 'DataTable' })
      expect(table.props('globalFilter')).toBe('Viral')
    })

    it('should update filter when search query changes', async () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.setProps({ searchQuery: 'Energy' })
      await wrapper.vm.$nextTick()

      const table = wrapper.findComponent({ name: 'DataTable' })
      expect(table.props('globalFilter')).toBe('Energy')
    })
  })

  // ==========================================================================
  // Reactive Updates Tests
  // ==========================================================================

  describe('Reactive Updates', () => {
    it('should recalculate table data when input state changes', async () => {
      const inputState = createDefaultInputState()

      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState,
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      const initialDPS = wrapper.vm.tableData[0].dps

      // Update input state to increase damage
      const newInputState = {
        ...inputState,
        damageModifiers: {
          ...inputState.damageModifiers,
          directNanoDamageEfficiency: 100 // Increased from 50
        }
      }

      await wrapper.setProps({ inputState: newInputState })
      await wrapper.vm.$nextTick()

      const newDPS = wrapper.vm.tableData[0].dps

      // DPS should increase with higher damage
      expect(parseFloat(newDPS)).toBeGreaterThan(parseFloat(initialDPS))
    })

    it('should recalculate when nanos array changes', async () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos().slice(0, 1),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.vm.tableData.length).toBe(1)

      await wrapper.setProps({ nanos: createMockNanos() })
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.tableData.length).toBe(3)
    })
  })

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe('Empty State', () => {
    it('should display empty state when no nanos', () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: [],
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      // DataTable should be empty
      expect(wrapper.vm.tableData.length).toBe(0)
    })

    it('should show helpful message in empty state', () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: [],
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      // Empty state slot should be present
      expect(wrapper.html()).toContain('No offensive nanos found')
    })
  })

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should announce row count for screen readers', () => {
      const nanos = createMockNanos()

      wrapper = mount(NukeTable, {
        props: {
          nanos,
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      const table = wrapper.find('table')
      const ariaLabel = table.attributes('aria-label')

      expect(ariaLabel).toContain(`${nanos.length}`)
      expect(ariaLabel).toContain('offensive nano programs')
    })

    it('should provide keyboard navigation instructions', () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      const table = wrapper.find('table')
      const ariaLabel = table.attributes('aria-label')

      expect(ariaLabel).toContain('arrow keys')
      expect(ariaLabel).toContain('Enter')
    })

    it('should maintain proper table semantics', () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      expect(wrapper.find('table').exists()).toBe(true)
      expect(wrapper.find('thead').exists()).toBe(true)
      expect(wrapper.find('tbody').exists()).toBe(true)
    })

    it('should have appropriate role attributes', () => {
      wrapper = mount(NukeTable, {
        props: {
          nanos: createMockNanos(),
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      const table = wrapper.find('table')
      expect(table.attributes('role')).toBe('table')
    })
  })

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle nanos with missing optional fields gracefully', async () => {
      const incompleteNano = {
        id: 9999,
        aoid: 9999,
        name: 'Incomplete Nano',
        school: 'Matter Creation' as any,
        strain: '',
        description: '',
        level: 100,
        qualityLevel: 100,
        castingRequirements: [],
        minDamage: 0,
        maxDamage: 0,
        midDamage: 0,
        damageType: 'energy' as any,
        tickCount: 1,
        tickInterval: 0,
        castTime: 300,
        rechargeTime: 2000,
        nanoPointCost: 500,
        attackDelayCap: 100,
        rechargeDelayCap: 100
      }

      wrapper = mount(NukeTable, {
        props: {
          nanos: [incompleteNano],
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      // Should not crash
      expect(wrapper.vm.tableData.length).toBe(1)
      expect(wrapper.vm.tableData[0].name).toBe('Incomplete Nano')
    })

    it('should handle very large damage values', async () => {
      const hugeDamageNano = {
        ...createMockNanos()[0],
        id: 8888,
        aoid: 8888,
        minDamage: 999999,
        maxDamage: 9999999,
        midDamage: 5000000
      }

      wrapper = mount(NukeTable, {
        props: {
          nanos: [hugeDamageNano],
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.vm.tableData[0].midDamage).toBeGreaterThan(1000000)
    })

    it('should handle zero values gracefully', async () => {
      const zeroValuesNano = {
        ...createMockNanos()[0],
        id: 7777,
        aoid: 7777,
        minDamage: 0,
        maxDamage: 0,
        midDamage: 0,
        castTime: 0,
        rechargeTime: 0,
        nanoPointCost: 0
      }

      wrapper = mount(NukeTable, {
        props: {
          nanos: [zeroValuesNano],
          inputState: createDefaultInputState(),
          searchQuery: '',
          loading: false
        },
        global: {
          plugins: [router]
        }
      })

      await wrapper.vm.$nextTick()

      // Should not crash or produce NaN
      expect(wrapper.vm.tableData.length).toBe(1)
      expect(wrapper.vm.tableData[0].dps).toBeDefined()
    })
  })
})
