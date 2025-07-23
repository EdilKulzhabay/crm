import { runPythonVRP } from './orTools.js';
import { spawn } from 'child_process';
import path from 'path';

// Тестовые данные из вашего лога
const testData = {
    couriers: [
        {
            id: '683dd48b54ed3e4c0adcc241',
            lat: 43.168277314921774,
            lon: 76.89654142009347
        },
        {
            id: '68413276b70d315d3b2b732f',
            lat: 43.2044094,
            lon: 76.893334
        }
    ],
    orders: [
        { id: '68662e7ee6675f4410cea767', lat: 43.292268, lon: 76.931119 },
        { id: '68665ce0e6675f4410ceda93', lat: 43.261362, lon: 76.929122 },
        { id: '6867e884e6675f4410d04ade', lat: 43.151319, lon: 76.901267 },
        { id: '6867e8b0e6675f4410d04b3c', lat: 43.228644, lon: 76.866358 },
        { id: '6867e8cde6675f4410d04b50', lat: 43.212045, lon: 76.872848 },
        { id: '6867e8ede6675f4410d04b7a', lat: 43.254082, lon: 76.918261 },
        { id: '68682a25e6675f4410d058b0', lat: 43.264191, lon: 76.932518 },
        { id: '6868b92c8bc69822dd93c6c0', lat: 43.237369, lon: 76.938627 },
        { id: '6868b96e8bc69822dd93c7ad', lat: 43.252214, lon: 76.90054 },
        { id: '6868b9e68bc69822dd93ca39', lat: 43.242453, lon: 76.9409 },
        { id: '6868ba138bc69822dd93cb3b', lat: 43.194514, lon: 76.896529 },
        { id: '6868bb778bc69822dd93d2cd', lat: 43.168765, lon: 76.873977 }
    ],
    courier_restrictions: {}
};

// Функция для запуска старого алгоритма
function runOldAlgorithm(couriers, orders, courier_restrictions) {
    return new Promise((resolve, reject) => {
        const pythonPath = process.platform === "win32"
            ? path.join(process.cwd(), "venv", "Scripts", "python.exe")
            : path.join(process.cwd(), "venv", "bin", "python");

        const python = spawn(pythonPath, ["./orTools/vrp_solver2.py"]);

        const input = {
            common_depot: { id: "depot", lat: 43.16857, lon: 76.89642 },
            couriers,
            orders,
            courier_restrictions,
        };

        let output = "";
        let error = "";

        python.stdout.on("data", (data) => {
            output += data.toString();
        });

        python.stderr.on("data", (data) => {
            error += data.toString();
        });

        python.on("close", (code) => {
            if (code === 0) {
                try {
                    const parsed = JSON.parse(output);
                    resolve(parsed);
                } catch (e) {
                    reject("Ошибка парсинга: " + e.message);
                }
            } else {
                reject(`Старый алгоритм завершился с кодом ${code}\n${error}`);
            }
        });

        python.stdin.write(JSON.stringify(input));
        python.stdin.end();
    });
}

// Функция для анализа результатов
function analyzeResults(routes, label) {
    const orderCounts = routes.map(r => r.orders_count);
    const distances = routes.map(r => r.distance_km);
    const totalDistance = distances.reduce((a, b) => a + b, 0);
    const maxOrders = Math.max(...orderCounts);
    const minOrders = Math.min(...orderCounts);
    const balance = maxOrders - minOrders;

    console.log(`\n=== ${label} ===`);
    console.log(`Распределение заказов: ${orderCounts.join('/')}`);
    console.log(`Расстояния: ${distances.join('км, ')}км`);
    console.log(`Общее расстояние: ${totalDistance.toFixed(2)}км`);
    console.log(`Балансировка: ${balance} (0 = идеальная)`);
    
    return {
        orderCounts,
        distances,
        totalDistance,
        balance
    };
}

// Основная функция тестирования
async function testOptimization() {
    console.log('🧪 Тестирование оптимизации VRP алгоритма...');
    console.log(`Курьеры: ${testData.couriers.length}`);
    console.log(`Заказы: ${testData.orders.length}`);
    
    try {
        // Запускаем старый алгоритм
        console.log('\n🔄 Запуск старого алгоритма...');
        const oldResults = await runOldAlgorithm(
            testData.couriers,
            testData.orders,
            testData.courier_restrictions
        );
        
        const oldAnalysis = analyzeResults(oldResults, 'СТАРЫЙ АЛГОРИТМ');
        
        // Запускаем новый алгоритм
        console.log('\n🔄 Запуск нового оптимизированного алгоритма...');
        const newResults = await runPythonVRP(
            testData.couriers,
            testData.orders,
            testData.courier_restrictions
        );
        
        const newAnalysis = analyzeResults(newResults, 'НОВЫЙ АЛГОРИТМ');
        
        // Сравнение результатов
        console.log('\n📊 СРАВНЕНИЕ РЕЗУЛЬТАТОВ:');
        console.log(`Улучшение балансировки: ${oldAnalysis.balance} → ${newAnalysis.balance} (${oldAnalysis.balance - newAnalysis.balance >= 0 ? '✅' : '❌'})`);
        console.log(`Изменение расстояния: ${oldAnalysis.totalDistance.toFixed(2)}км → ${newAnalysis.totalDistance.toFixed(2)}км (${(newAnalysis.totalDistance - oldAnalysis.totalDistance).toFixed(2)}км)`);
        
        if (newAnalysis.balance < oldAnalysis.balance) {
            console.log('🎉 Новый алгоритм показал лучшую балансировку!');
        }
        
        if (newAnalysis.totalDistance < oldAnalysis.totalDistance) {
            console.log('🎉 Новый алгоритм показал лучшее расстояние!');
        }
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error);
    }
}

// Запуск теста
testOptimization(); 