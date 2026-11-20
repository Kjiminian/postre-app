
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  name: 'name',
  role: 'role',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SupplierScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  phone: 'phone',
  notes: 'notes',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductCategoryScalarFieldEnum = {
  id: 'id',
  code: 'code',
  slug: 'slug',
  name: 'name',
  description: 'description',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MeasureUnitScalarFieldEnum = {
  id: 'id',
  code: 'code',
  symbol: 'symbol',
  name: 'name',
  unitType: 'unitType',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.IngredientScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  category: 'category',
  supplierId: 'supplierId',
  packagePriceCents: 'packagePriceCents',
  packageQty: 'packageQty',
  packageUnit: 'packageUnit',
  baseUnit: 'baseUnit',
  factorId: 'factorId',
  conversionFactor: 'conversionFactor',
  costPerBaseUnit: 'costPerBaseUnit',
  density: 'density',
  isActive: 'isActive',
  notes: 'notes',
  importedFrom: 'importedFrom',
  reviewFlag: 'reviewFlag',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RecipeScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  description: 'description',
  recipeType: 'recipeType',
  yield: 'yield',
  yieldUnit: 'yieldUnit',
  packageCostCents: 'packageCostCents',
  laborPercent: 'laborPercent',
  overheadPercent: 'overheadPercent',
  contingencyPercent: 'contingencyPercent',
  subtotalBeforeContingencyCents: 'subtotalBeforeContingencyCents',
  batchCostExactCents: 'batchCostExactCents',
  commercialRefCents: 'commercialRefCents',
  targetMargin: 'targetMargin',
  batchCostCents: 'batchCostCents',
  unitCostCents: 'unitCostCents',
  costPerYieldUnit: 'costPerYieldUnit',
  suggestedPriceCents: 'suggestedPriceCents',
  currentPriceCents: 'currentPriceCents',
  status: 'status',
  reviewFlag: 'reviewFlag',
  notes: 'notes',
  importedFrom: 'importedFrom',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RecipePresentationScalarFieldEnum = {
  id: 'id',
  recipeId: 'recipeId',
  name: 'name',
  sizeDescription: 'sizeDescription',
  motherRecipeQty: 'motherRecipeQty',
  motherRecipeUnit: 'motherRecipeUnit',
  consumptionMode: 'consumptionMode',
  batchFraction: 'batchFraction',
  presentationYield: 'presentationYield',
  baseCostCents: 'baseCostCents',
  unitTotalCostExactCents: 'unitTotalCostExactCents',
  packagingCostCents: 'packagingCostCents',
  additionalCostCents: 'additionalCostCents',
  totalCostCents: 'totalCostCents',
  pricingMethod: 'pricingMethod',
  desiredMarginPercent: 'desiredMarginPercent',
  suggestedPriceCents: 'suggestedPriceCents',
  finalPriceCents: 'finalPriceCents',
  realProfitCents: 'realProfitCents',
  realMarginPercent: 'realMarginPercent',
  isActive: 'isActive',
  isComposite: 'isComposite',
  parentId: 'parentId',
  groupQty: 'groupQty',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PresentationMaterialScalarFieldEnum = {
  id: 'id',
  presentationId: 'presentationId',
  ingredientId: 'ingredientId',
  materialType: 'materialType',
  name: 'name',
  quantity: 'quantity',
  unit: 'unit',
  unitCostCents: 'unitCostCents',
  totalCostCents: 'totalCostCents'
};

exports.Prisma.PresentationSubrecipeScalarFieldEnum = {
  id: 'id',
  presentationId: 'presentationId',
  subRecipeId: 'subRecipeId',
  name: 'name',
  quantity: 'quantity',
  unit: 'unit',
  costCents: 'costCents'
};

exports.Prisma.RecipeIngredientScalarFieldEnum = {
  id: 'id',
  recipeId: 'recipeId',
  ingredientId: 'ingredientId',
  quantity: 'quantity',
  unit: 'unit',
  costCents: 'costCents',
  notes: 'notes'
};

exports.Prisma.SubRecipeUseScalarFieldEnum = {
  id: 'id',
  parentId: 'parentId',
  childId: 'childId',
  quantity: 'quantity',
  costCents: 'costCents'
};

exports.Prisma.RecipePriceHistoryScalarFieldEnum = {
  id: 'id',
  recipeId: 'recipeId',
  batchCostCents: 'batchCostCents',
  unitCostCents: 'unitCostCents',
  priceCents: 'priceCents',
  margin: 'margin',
  recordedAt: 'recordedAt',
  reason: 'reason'
};

exports.Prisma.CustomerScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  phone: 'phone',
  email: 'email',
  notes: 'notes',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SaleScalarFieldEnum = {
  id: 'id',
  saleDate: 'saleDate',
  customerId: 'customerId',
  customerName: 'customerName',
  notes: 'notes',
  totalCents: 'totalCents',
  totalCostCents: 'totalCostCents',
  collectedCents: 'collectedCents',
  balanceCents: 'balanceCents',
  paymentMethod: 'paymentMethod',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  weeklyCloseId: 'weeklyCloseId'
};

exports.Prisma.SaleItemScalarFieldEnum = {
  id: 'id',
  saleId: 'saleId',
  recipeId: 'recipeId',
  presentationId: 'presentationId',
  productName: 'productName',
  quantity: 'quantity',
  unitPriceCents: 'unitPriceCents',
  totalCents: 'totalCents',
  unitCostCents: 'unitCostCents',
  totalCostCents: 'totalCostCents',
  notes: 'notes'
};

exports.Prisma.PaymentScalarFieldEnum = {
  id: 'id',
  saleId: 'saleId',
  amountCents: 'amountCents',
  method: 'method',
  paidAt: 'paidAt',
  reference: 'reference',
  notes: 'notes'
};

exports.Prisma.WeeklyCloseScalarFieldEnum = {
  id: 'id',
  weekStart: 'weekStart',
  weekEnd: 'weekEnd',
  invoicedCents: 'invoicedCents',
  collectedCents: 'collectedCents',
  pendingCents: 'pendingCents',
  costOfGoodsCents: 'costOfGoodsCents',
  operationalExpCents: 'operationalExpCents',
  netResultCents: 'netResultCents',
  cashFundCents: 'cashFundCents',
  expectedCashCents: 'expectedCashCents',
  countedCashCents: 'countedCashCents',
  cashDifferenceCents: 'cashDifferenceCents',
  isClosed: 'isClosed',
  closedAt: 'closedAt',
  notes: 'notes',
  modifiedAfterClose: 'modifiedAfterClose',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ExpenseCategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  isActive: 'isActive'
};

exports.Prisma.OperationalExpenseScalarFieldEnum = {
  id: 'id',
  expenseDate: 'expenseDate',
  categoryId: 'categoryId',
  concept: 'concept',
  baseAmountCents: 'baseAmountCents',
  percentage: 'percentage',
  amountCents: 'amountCents',
  paymentMethod: 'paymentMethod',
  weeklyCloseId: 'weeklyCloseId',
  notes: 'notes',
  isIngredientPurchase: 'isIngredientPurchase',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UnitConversionRefScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  category: 'category',
  fromUnit: 'fromUnit',
  toUnit: 'toUnit',
  factor: 'factor',
  ingredient: 'ingredient',
  isEditable: 'isEditable',
  isActive: 'isActive',
  source: 'source',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ImportSessionScalarFieldEnum = {
  id: 'id',
  fileName: 'fileName',
  fileSizeKb: 'fileSizeKb',
  sheetCount: 'sheetCount',
  status: 'status',
  mappingJson: 'mappingJson',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ImportRowScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  sheetName: 'sheetName',
  rowIndex: 'rowIndex',
  rawDataJson: 'rawDataJson',
  mappedDataJson: 'mappedDataJson',
  status: 'status',
  errorMessage: 'errorMessage',
  isDuplicate: 'isDuplicate',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  User: 'User',
  Supplier: 'Supplier',
  ProductCategory: 'ProductCategory',
  MeasureUnit: 'MeasureUnit',
  Ingredient: 'Ingredient',
  Recipe: 'Recipe',
  RecipePresentation: 'RecipePresentation',
  PresentationMaterial: 'PresentationMaterial',
  PresentationSubrecipe: 'PresentationSubrecipe',
  RecipeIngredient: 'RecipeIngredient',
  SubRecipeUse: 'SubRecipeUse',
  RecipePriceHistory: 'RecipePriceHistory',
  Customer: 'Customer',
  Sale: 'Sale',
  SaleItem: 'SaleItem',
  Payment: 'Payment',
  WeeklyClose: 'WeeklyClose',
  ExpenseCategory: 'ExpenseCategory',
  OperationalExpense: 'OperationalExpense',
  UnitConversionRef: 'UnitConversionRef',
  ImportSession: 'ImportSession',
  ImportRow: 'ImportRow'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
