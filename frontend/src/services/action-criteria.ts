/**
 * Action and Criteria Interpretation Service
 * 
 * Provides utilities for parsing, transforming, and displaying action requirements
 * and criteria in an intuitive format for players.
 */

import {
  TEMPLATE_ACTION,
  OPERATOR,
  STAT,
  PROFESSION,
  BREED,
  GENDER
} from './game-data'
import { getStatName, getProfessionName, getBreedName, getGenderName } from './game-utils'
import type { Action, Criterion } from '../types/api'

// ============================================================================
// Core Interfaces
// ============================================================================

export interface ParsedCriterion {
  id: number
  stat: number
  statName: string
  value: number
  operator: number
  operatorName: string
  rawDescription: string
}

export interface DisplayCriterion {
  id: number
  stat: number
  statName: string
  displayValue: number
  displayOperator: string
  displaySymbol: string
  description: string
  isLogicalOperator: boolean
  isSeparator: boolean
  isStatRequirement: boolean
}

export interface CriteriaExpression {
  type: 'criterion' | 'logical' | 'group'
  criterion?: DisplayCriterion
  operator?: string
  operands?: CriteriaExpression[]
  description: string
}

export interface CriteriaTreeNode {
  type: 'requirement' | 'operator' | 'group'
  operator?: 'AND' | 'OR' | 'NOT'
  criterion?: DisplayCriterion
  children?: CriteriaTreeNode[]
  status?: 'met' | 'unmet' | 'unknown' | 'partial'
  level: number
  isLast?: boolean
  hasChildren?: boolean
  metCount?: number
  totalCount?: number
}

export interface ParsedAction {
  id: number
  action: number
  actionName: string
  criteria: DisplayCriterion[]
  expression?: CriteriaExpression
  hasRequirements: boolean
  description: string
}

// ============================================================================
// Operator and Display Constants
// ============================================================================

const LOGICAL_OPERATORS = {
  3: 'OR',
  4: 'AND', 
  42: 'NOT'
} as const

const DISPLAY_OPERATORS = {
  0: { symbol: '=', name: 'Equal to' },
  1: { symbol: '≤', name: 'Less than or equal to' },
  2: { symbol: '≥', name: 'Greater than or equal to' },
  22: { symbol: 'has', name: 'Has bit flag' },
  24: { symbol: '≠', name: 'Not equal to' },
  107: { symbol: 'lacks', name: 'Lacks bit flag' }
} as const

const STATE_OPERATORS = {
  44: 'Must be NPC',
  45: 'Must be fighting',
  134: 'Must not be fighting',
  66: 'Must have no regular pets',
  70: 'Must be flying',
  80: 'Tower creation allowed',
  83: 'Can disable defense shield',
  86: 'Must be player or player pet',
  89: 'Must be falling',
  111: 'Must not be in vehicle',
  112: 'Flying allowed'
} as const

// ============================================================================
// Core Parsing Functions
// ============================================================================

/**
 * Parse a raw criterion into a structured format
 */
export function parseCriterion(criterion: Criterion): ParsedCriterion {
  const statName = getStatName(criterion.value1) || `Stat ${criterion.value1}`
  const operatorName = OPERATOR[criterion.operator as keyof typeof OPERATOR] || `Op ${criterion.operator}`
  
  const rawDescription = `${statName} ${operatorName} ${criterion.value2}`
  
  return {
    id: criterion.id,
    stat: criterion.value1,
    statName,
    value: criterion.value2,
    operator: criterion.operator,
    operatorName,
    rawDescription
  }
}

/**
 * Transform a criterion for intuitive display
 */
export function transformCriterionForDisplay(criterion: Criterion): DisplayCriterion {
  const { id, value1: stat, value2: value, operator } = criterion
  const statName = getStatName(stat) || `Stat ${stat}`
  
  // Check for logical operators (separators and logical ops)
  if (stat === 0 && value === 0) {
    const isLogicalOp = operator in LOGICAL_OPERATORS
    const isSeparator = operator === 4 // AND used as separator
    
    return {
      id,
      stat,
      statName: 'Logical',
      displayValue: value,
      displayOperator: isLogicalOp ? LOGICAL_OPERATORS[operator as keyof typeof LOGICAL_OPERATORS] : `Op${operator}`,
      displaySymbol: isLogicalOp ? LOGICAL_OPERATORS[operator as keyof typeof LOGICAL_OPERATORS] : `Op${operator}`,
      description: isLogicalOp ? LOGICAL_OPERATORS[operator as keyof typeof LOGICAL_OPERATORS] : `Operator ${operator}`,
      isLogicalOperator: isLogicalOp,
      isSeparator,
      isStatRequirement: false
    }
  }
  
  // Handle state operators
  if (operator in STATE_OPERATORS) {
    return {
      id,
      stat,
      statName,
      displayValue: value,
      displayOperator: 'state',
      displaySymbol: 'state',
      description: STATE_OPERATORS[operator as keyof typeof STATE_OPERATORS],
      isLogicalOperator: false,
      isSeparator: false,
      isStatRequirement: false
    }
  }
  
  // Handle standard stat requirements with transformations
  let displayValue = value
  let displayOperator = '='
  let displaySymbol = '='
  let description = ''
  
  switch (operator) {
    case 0: // StatEqual
      displayValue = value
      displayOperator = 'Equal to'
      displaySymbol = '='
      description = formatStatDescription(stat, displayValue, displaySymbol)
      break
      
    case 1: // StatLessThan - transform "< X" to "≤ X-1"
      displayValue = value - 1
      displayOperator = 'Less than or equal to'
      displaySymbol = '≤'
      description = formatStatDescription(stat, displayValue, displaySymbol)
      break
      
    case 2: // StatGreaterThan - transform "> X" to "≥ X+1"
      displayValue = value + 1
      displayOperator = 'Greater than or equal to'
      displaySymbol = '≥'
      description = formatStatDescription(stat, displayValue, displaySymbol)
      break
      
    case 22: // StatBitSet
      displayOperator = 'Has bit flag'
      displaySymbol = 'has'
      description = `${statName} has flag ${value}`
      break
      
    case 24: // StatNotEqual
      displayValue = value
      displayOperator = 'Not equal to'
      displaySymbol = '≠'
      description = formatStatDescription(stat, displayValue, displaySymbol)
      break
      
    case 107: // StatBitNotSet
      displayOperator = 'Lacks bit flag'
      displaySymbol = 'lacks'
      description = `${statName} lacks flag ${value}`
      break
      
    default:
      displayOperator = `Op${operator}`
      displaySymbol = `Op${operator}`
      description = `${statName} ${displaySymbol} ${displayValue}`
  }
  
  return {
    id,
    stat,
    statName,
    displayValue,
    displayOperator,
    displaySymbol,
    description,
    isLogicalOperator: false,
    isSeparator: false,
    isStatRequirement: true
  }
}

/**
 * Format stat description with special handling for certain stats
 */
function formatStatDescription(stat: number, value: number, symbol: string): string {
  const statName = getStatName(stat) || `Stat ${stat}`
  
  // Special formatting for specific stats
  switch (stat) {
    case 54: // Level
      return `Level ${symbol} ${value}`
      
    case 60: // Profession
      const professionName = getProfessionName(value)
      if (professionName && symbol === '=') {
        return `Profession = ${professionName}`
      }
      return `Profession ${symbol} ${value}`
      
    case 4: // Breed
      const breedName = getBreedName(value)
      if (breedName && symbol === '=') {
        return `Breed = ${breedName}`
      }
      return `Breed ${symbol} ${value}`
      
    case 59: // Gender
      const genderName = getGenderName(value)
      if (genderName && symbol === '=') {
        return `Gender = ${genderName}`
      }
      return `Gender ${symbol} ${value}`
      
    default:
      return `${statName} ${symbol} ${value}`
  }
}

/**
 * Parse criteria array into reverse polish notation expression tree
 */
export function parseCriteriaExpression(criteria: Criterion[]): CriteriaExpression | null {
  if (!criteria || criteria.length === 0) {
    return null
  }
  
  const stack: CriteriaExpression[] = []
  
  for (const criterion of criteria) {
    const displayCriterion = transformCriterionForDisplay(criterion)
    
    if (displayCriterion.isLogicalOperator) {
      // Handle logical operators (OR, AND, NOT)
      const operator = displayCriterion.displayOperator
      
      if (operator === 'NOT') {
        // Unary operator - pop one operand
        const operand = stack.pop()
        if (operand) {
          stack.push({
            type: 'logical',
            operator: 'NOT',
            operands: [operand],
            description: `NOT (${operand.description})`
          })
        }
      } else {
        // Binary operator - pop two operands
        const right = stack.pop()
        const left = stack.pop()
        if (left && right) {
          stack.push({
            type: 'logical',
            operator,
            operands: [left, right],
            description: `(${left.description} ${operator} ${right.description})`
          })
        }
      }
    } else if (displayCriterion.isSeparator) {
      // Separators typically just group requirements
      continue
    } else {
      // Regular criterion - push to stack
      stack.push({
        type: 'criterion',
        criterion: displayCriterion,
        description: displayCriterion.description
      })
    }
  }
  
  // Return the final expression (should be single item on stack)
  return stack.length > 0 ? stack[0] : null
}

/**
 * Parse a complete action with its criteria
 */
export function parseAction(action: Action): ParsedAction {
  const actionName = TEMPLATE_ACTION[action.action as keyof typeof TEMPLATE_ACTION] || `Action ${action.action}`
  const criteria = action.criteria.map(transformCriterionForDisplay)
  const expression = parseCriteriaExpression(action.criteria)
  const hasRequirements = criteria.some(c => c.isStatRequirement)
  
  const description = hasRequirements 
    ? `${actionName}: ${expression?.description || 'Has requirements'}`
    : `${actionName}: No requirements`
  
  return {
    id: action.id,
    action: action.action || 0,
    actionName,
    criteria,
    expression,
    hasRequirements,
    description
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all stat requirements from criteria (excluding logical operators)
 */
export function getCriteriaRequirements(criteria: Criterion[]): Array<{
  stat: number
  statName: string
  minValue?: number
  maxValue?: number
  exactValue?: number
  mustHaveFlag?: number
  mustLackFlag?: number
}> {
  const requirements: Map<number, any> = new Map()
  
  for (const criterion of criteria) {
    const display = transformCriterionForDisplay(criterion)
    
    if (!display.isStatRequirement) continue
    
    const existing = requirements.get(display.stat) || {
      stat: display.stat,
      statName: display.statName
    }
    
    // Update requirement based on operator
    switch (criterion.operator) {
      case 0: // Equal
        existing.exactValue = display.displayValue
        break
      case 1: // LessThan (transformed to ≤)
        existing.maxValue = Math.min(existing.maxValue || display.displayValue, display.displayValue)
        break
      case 2: // GreaterThan (transformed to ≥)
        existing.minValue = Math.max(existing.minValue || display.displayValue, display.displayValue)
        break
      case 22: // BitSet
        existing.mustHaveFlag = criterion.value2
        break
      case 107: // BitNotSet
        existing.mustLackFlag = criterion.value2
        break
    }
    
    requirements.set(display.stat, existing)
  }
  
  return Array.from(requirements.values())
}

/**
 * Check if character meets action requirements
 */
export function checkActionRequirements(
  action: ParsedAction, 
  characterStats: Record<number, number>
): { 
  canPerform: boolean
  unmetRequirements: Array<{
    stat: number
    statName: string
    required: number
    current: number
    operator: string
  }>
} {
  const unmetRequirements: Array<{
    stat: number
    statName: string
    required: number
    current: number
    operator: string
  }> = []
  
  for (const criterion of action.criteria) {
    if (!criterion.isStatRequirement) continue
    
    const currentValue = characterStats[criterion.stat] || 0
    let requirementMet = false
    
    switch (criterion.displaySymbol) {
      case '=':
        requirementMet = currentValue === criterion.displayValue
        break
      case '≤':
        requirementMet = currentValue <= criterion.displayValue
        break
      case '≥':
        requirementMet = currentValue >= criterion.displayValue
        break
      case '≠':
        requirementMet = currentValue !== criterion.displayValue
        break
      case 'has':
        requirementMet = (currentValue & criterion.displayValue) === criterion.displayValue
        break
      case 'lacks':
        requirementMet = (currentValue & criterion.displayValue) === 0
        break
      default:
        requirementMet = true // Unknown operator, assume met
    }
    
    if (!requirementMet) {
      unmetRequirements.push({
        stat: criterion.stat,
        statName: criterion.statName,
        required: criterion.displayValue,
        current: currentValue,
        operator: criterion.displaySymbol
      })
    }
  }
  
  return {
    canPerform: unmetRequirements.length === 0,
    unmetRequirements
  }
}

/**
 * Format criteria expression as readable text
 */
export function formatCriteriaText(expression: CriteriaExpression): string {
  if (!expression) return ''
  
  switch (expression.type) {
    case 'criterion':
      return expression.criterion?.description || ''
      
    case 'logical':
      if (!expression.operands || expression.operands.length === 0) return ''
      
      if (expression.operator === 'NOT') {
        return `NOT (${formatCriteriaText(expression.operands[0])})`
      }
      
      const left = formatCriteriaText(expression.operands[0])
      const right = formatCriteriaText(expression.operands[1])
      return `(${left} ${expression.operator} ${right})`
      
    case 'group':
      if (!expression.operands) return ''
      return expression.operands.map(formatCriteriaText).join(' AND ')
      
    default:
      return expression.description
  }
}

// ============================================================================
// Tree Structure Building Functions
// ============================================================================

/**
 * Build a hierarchical tree structure from flat criteria array
 */
export function buildCriteriaTree(
  criteria: Criterion[], 
  characterStats?: Record<number, number>
): CriteriaTreeNode | null {
  if (!criteria || criteria.length === 0) {
    return null
  }

  // Transform all criteria to display format
  const displayCriteria = criteria.map(transformCriterionForDisplay)
  
  // Simple case: only stat requirements (all AND)
  const statRequirements = displayCriteria.filter(c => c.isStatRequirement)
  const logicalOperators = displayCriteria.filter(c => c.isLogicalOperator)
  
  if (logicalOperators.length === 0) {
    // Simple list of requirements
    return createSimpleRequirementsList(statRequirements, characterStats)
  }
  
  // Complex case: build tree from reverse polish notation
  return buildTreeFromRPN(displayCriteria, characterStats)
}

/**
 * Create a simple list node for AND-only requirements
 */
function createSimpleRequirementsList(
  requirements: DisplayCriterion[],
  characterStats?: Record<number, number>
): CriteriaTreeNode {
  const children = requirements.map((criterion, index) => ({
    type: 'requirement' as const,
    criterion,
    level: 1,
    isLast: index === requirements.length - 1,
    hasChildren: false,
    status: evaluateCriterionStatus(criterion, characterStats)
  }))
  
  const { metCount, totalCount } = calculateNodeStats(children)
  
  return {
    type: 'group',
    children,
    level: 0,
    hasChildren: true,
    metCount,
    totalCount,
    status: metCount === totalCount ? 'met' : (metCount > 0 ? 'partial' : 'unmet')
  }
}

/**
 * Build tree from reverse polish notation expression
 */
function buildTreeFromRPN(
  displayCriteria: DisplayCriterion[],
  characterStats?: Record<number, number>
): CriteriaTreeNode | null {
  const stack: CriteriaTreeNode[] = []
  
  for (const criterion of displayCriteria) {
    if (criterion.isStatRequirement) {
      // Push requirement node onto stack
      stack.push({
        type: 'requirement',
        criterion,
        level: 0, // Will be set during tree finalization
        hasChildren: false,
        status: evaluateCriterionStatus(criterion, characterStats)
      })
    } else if (criterion.isLogicalOperator) {
      // Pop operands and create operator node
      const operatorNode = createOperatorNode(criterion, stack)
      if (operatorNode) {
        stack.push(operatorNode)
      }
    }
  }
  
  // Should have exactly one node left (the root)
  if (stack.length !== 1) {
    // Fallback: create a simple group
    return createSimpleRequirementsList(
      displayCriteria.filter(c => c.isStatRequirement),
      characterStats
    )
  }
  
  const root = stack[0]
  finalizeTreeStructure(root, 0)
  return root
}

/**
 * Create an operator node from criteria and stack
 */
function createOperatorNode(
  criterion: DisplayCriterion,
  stack: CriteriaTreeNode[]
): CriteriaTreeNode | null {
  const operatorMap: Record<string, string> = {
    'AND': 'AND',
    'OR': 'OR',
    'NOT': 'NOT'
  }
  
  const operator = operatorMap[criterion.displayOperator] as 'AND' | 'OR' | 'NOT'
  if (!operator) return null
  
  let children: CriteriaTreeNode[] = []
  
  if (operator === 'NOT') {
    // NOT takes one operand
    const operand = stack.pop()
    if (operand) {
      children = [operand]
    }
  } else {
    // AND/OR take two operands
    const right = stack.pop()
    const left = stack.pop()
    if (left && right) {
      children = [left, right]
    }
  }
  
  const { metCount, totalCount } = calculateNodeStats(children)
  
  let status: 'met' | 'unmet' | 'partial' | 'unknown'
  if (operator === 'AND') {
    status = metCount === totalCount ? 'met' : (metCount > 0 ? 'partial' : 'unmet')
  } else if (operator === 'OR') {
    status = metCount > 0 ? 'met' : 'unmet'
  } else { // NOT
    const childStatus = children[0]?.status
    status = childStatus === 'unmet' ? 'met' : (childStatus === 'met' ? 'unmet' : 'unknown')
  }
  
  return {
    type: 'operator',
    operator,
    children,
    level: 0, // Will be set during finalization
    hasChildren: children.length > 0,
    metCount,
    totalCount,
    status
  }
}

/**
 * Evaluate the status of a single criterion
 */
function evaluateCriterionStatus(
  criterion: DisplayCriterion,
  characterStats?: Record<number, number>
): 'met' | 'unmet' | 'unknown' {
  if (!characterStats || !criterion.isStatRequirement) {
    return 'unknown'
  }
  
  const currentValue = characterStats[criterion.stat] || 0
  
  switch (criterion.displaySymbol) {
    case '=':
      return currentValue === criterion.displayValue ? 'met' : 'unmet'
    case '≤':
      return currentValue <= criterion.displayValue ? 'met' : 'unmet'
    case '≥':
      return currentValue >= criterion.displayValue ? 'met' : 'unmet'
    case '≠':
      return currentValue !== criterion.displayValue ? 'met' : 'unmet'
    case 'has':
      return (currentValue & criterion.displayValue) === criterion.displayValue ? 'met' : 'unmet'
    case 'lacks':
      return (currentValue & criterion.displayValue) === 0 ? 'met' : 'unmet'
    default:
      return 'unknown'
  }
}

/**
 * Calculate statistics for a tree node
 */
function calculateNodeStats(children: CriteriaTreeNode[]): { metCount: number; totalCount: number } {
  let metCount = 0
  let totalCount = 0
  
  for (const child of children) {
    if (child.type === 'requirement') {
      totalCount++
      if (child.status === 'met') metCount++
    } else if (child.metCount !== undefined && child.totalCount !== undefined) {
      metCount += child.metCount
      totalCount += child.totalCount
    }
  }
  
  return { metCount, totalCount }
}

/**
 * Finalize tree structure by setting levels and tree properties
 */
function finalizeTreeStructure(node: CriteriaTreeNode, level: number): void {
  node.level = level
  
  if (node.children) {
    node.children.forEach((child, index) => {
      child.isLast = index === node.children!.length - 1
      finalizeTreeStructure(child, level + 1)
    })
  }
}

/**
 * Check if criteria should use tree display
 */
export function shouldUseTreeDisplay(criteria: Criterion[]): boolean {
  if (!criteria || criteria.length <= 2) return false
  
  const displayCriteria = criteria.map(transformCriterionForDisplay)
  const logicalOperators = displayCriteria.filter(c => c.isLogicalOperator)
  
  // Use tree display if there are logical operators or many requirements
  return logicalOperators.length > 0 || displayCriteria.filter(c => c.isStatRequirement).length > 3
}

/**
 * Get simplified description for tree summary
 */
export function getTreeSummary(tree: CriteriaTreeNode | null): string {
  if (!tree) return 'No requirements'
  
  const { metCount = 0, totalCount = 0 } = tree
  
  if (totalCount === 0) return 'No requirements'
  if (totalCount === 1) {
    const requirement = findFirstRequirement(tree)
    return requirement?.criterion?.description || 'Unknown requirement'
  }
  
  return `${totalCount} requirement${totalCount !== 1 ? 's' : ''}${
    metCount !== totalCount ? ` (${totalCount - metCount} unmet)` : ''
  }`
}

/**
 * Find the first requirement in a tree
 */
function findFirstRequirement(node: CriteriaTreeNode): CriteriaTreeNode | null {
  if (node.type === 'requirement') return node
  
  if (node.children) {
    for (const child of node.children) {
      const found = findFirstRequirement(child)
      if (found) return found
    }
  }
  
  return null
}

// ============================================================================
// Export utility object for easy importing
// ============================================================================

export const actionCriteriaService = {
  parseCriterion,
  transformCriterionForDisplay,
  parseCriteriaExpression,
  parseAction,
  getCriteriaRequirements,
  checkActionRequirements,
  formatCriteriaText,
  buildCriteriaTree,
  shouldUseTreeDisplay,
  getTreeSummary,
  
  // Constants
  LOGICAL_OPERATORS,
  DISPLAY_OPERATORS,
  STATE_OPERATORS
}