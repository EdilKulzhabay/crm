import { solveVRP, visualizeRoutes, solveAndVisualize } from './vrp_api.js';

// Тестовые данные
const testCouriers = [
    {"id": "courier1", "lat": 43.207262, "lon": 76.893349},
    {"id": "courier2", "lat": 43.22000, "lon": 76.85000},
    {"id": "courier3", "lat": 43.28000, "lon": 76.95000}
];

const testOrders = [
    {"id": "order1", "lat": 43.212409, "lon": 76.842149},
    {"id": "order2", "lat": 43.249392, "lon": 76.887507},
    {"id": "order3", "lat": 43.245447, "lon": 76.903766},
    {"id": "order4", "lat": 43.230026, "lon": 76.94556},
    {"id": "order5", "lat": 43.228736, "lon": 76.839826},
    {"id": "order6", "lat": 43.292268, "lon": 76.931119},
    {"id": "order7", "lat": 43.261362, "lon": 76.929122},
    {"id": "order8", "lat": 43.236701, "lon": 76.845539},
    {"id": "order9", "lat": 43.257476, "lon": 76.905942},
    {"id": "order10", "lat": 43.236031, "lon": 76.837653}
];

const testRestrictions = {
    "order1": [1, 2],  // только courier2 и courier3 (1-based индексы)
    "order2": [1, 2],  // только courier2 и courier3
    "order7": [2]      // только courier3
};

const testCommonDepot = {
    "id": "depot", 
    "lat": 43.16857, 
    "lon": 76.89642
};

async function testVRPSolver() {
    console.log('=== Тест VRP Solver ===');
    try {
        const result = await solveVRP(testCouriers, testOrders, testRestrictions, testCommonDepot);
        console.log('Результат VRP:', JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error('Ошибка VRP Solver:', error.message);
        return null;
    }
}

async function testVisualization(vrpResult) {
    console.log('\n=== Тест Визуализации ===');
    if (!vrpResult || !vrpResult.routes) {
        console.log('Нет данных для визуализации');
        return;
    }
    
    try {
        const result = await visualizeRoutes(testCouriers, testOrders, vrpResult.routes, testCommonDepot);
        console.log('Результат визуализации:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Ошибка визуализации:', error.message);
    }
}

async function testFullCycle() {
    console.log('\n=== Тест полного цикла ===');
    try {
        const result = await solveAndVisualize(testCouriers, testOrders, testRestrictions, testCommonDepot);
        console.log('Результат полного цикла:');
        console.log('- VRP результат:', JSON.stringify(result.vrp_result, null, 2));
        console.log('- Визуализация:', JSON.stringify(result.visualization, null, 2));
    } catch (error) {
        console.error('Ошибка полного цикла:', error.message);
    }
}

// Запуск тестов
async function runTests() {
    console.log('Запуск тестов Node.js API для VRP...\n');
    
    // Тест 1: Только VRP решение
    const vrpResult = await testVRPSolver();
    
    // Тест 2: Только визуализация (если есть результат VRP)
    await testVisualization(vrpResult);
    
    // Тест 3: Полный цикл
    await testFullCycle();
    
    console.log('\nТесты завершены!');
}

// Запуск, если файл выполняется напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests();
} 