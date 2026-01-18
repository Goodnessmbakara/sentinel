const { X402Handler } = require('../dist/src/execution/x402Handler');
const { ethers } = require('ethers');

/**
 * x402 Testnet Validation Script
 * 
 * Tests x402 payment instruction creation and validates structure
 */

async function testX402Flow() {
    console.log('🧪 Testing x402 Payment Instruction Flow\n');

    // Test parameters (example trade)
    const tradeParams = {
        tokenIn: '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23', // WCRO testnet
        tokenOut: '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59', // USDC testnet
        amountIn: ethers.parseEther('10').toString(), // 10 tokens
        minAmountOut: ethers.parseEther('9.5').toString(), // 5% slippage
        recipient: '0x40a2Aa83271dd2F86e7C50C05b60bf3873bA4461' // Test wallet
    };

    console.log('📋 Trade Parameters:');
    console.log(JSON.stringify(tradeParams, null, 2));
    console.log('');

    // Test 1: Check if x402 is enabled
    console.log('✓ Test 1: Feature Flag Check');
    const isEnabled = X402Handler.isEnabled();
    console.log(`  USE_X402 = ${process.env.USE_X402}`);
    console.log(`  isEnabled() = ${isEnabled}`);
    console.log('');

    // Test 2: Create payment instruction
    console.log('✓ Test 2: Payment Instruction Creation');
    const instruction = X402Handler.createPaymentInstruction(tradeParams);
    console.log('  Payment Instruction Structure:');
    console.log(JSON.stringify(instruction, null, 2));
    console.log('');

    // Test 3: Validate instruction structure
    console.log('✓ Test 3: Instruction Validation');
    const validations = [
        { check: 'Has type field', result: !!instruction.type },
        { check: 'Type is trade_execution', result: instruction.type === 'trade_execution' },
        { check: 'Has version', result: !!instruction.version },
        { check: 'Has timestamp', result: !!instruction.timestamp },
        { check: 'Has payload', result: !!instruction.payload },
        { check: 'Has payment model', result: instruction.payment?.model === 'exact' },
        { check: 'Payment cost matches amountIn', result: instruction.payment?.cost === tradeParams.amountIn }
    ];

    validations.forEach(v => {
        console.log(`  ${v.result ? '✅' : '❌'} ${v.check}: ${v.result}`);
    });
    console.log('');

    // Test 4: Fee calculation
    console.log('✓ Test 4: Fee Calculation');
    const profitWei = ethers.parseEther('2'); // 2 token profit
    const fee = X402Handler.calculateFee(profitWei);
    const expectedFee = (profitWei * 5n) / 100n;
    console.log(`  Profit: ${ethers.formatEther(profitWei)} tokens`);
    console.log(`  Fee (5%): ${ethers.formatEther(fee)} tokens`);
    console.log(`  Expected: ${ethers.formatEther(expectedFee)} tokens`);
    console.log(`  ${fee === expectedFee ? '✅' : '❌'} Calculation correct: ${fee === expectedFee}`);
    console.log('');

    // Test 5: Payment headers
    console.log('✓ Test 5: x402 Headers Generation');
    const headers = X402Handler.getHeader('trade_execution', 'exact', 1000000);
    console.log('  Headers:');
    console.log(JSON.stringify(headers, null, 2));
    console.log('');

    // Summary
    console.log('📊 Test Summary');
    const allPassed = validations.every(v => v.result) && (fee === expectedFee);
    console.log(`  Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log(`  x402 Feature: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log('');

    console.log('💡 Next Steps:');
    console.log('  1. Enable x402: Set USE_X402=true in .env');
    console.log('  2. Restart API: npm run start:api');
    console.log('  3. Test trade execution with x402 enabled');
    console.log('  4. Monitor logs for payment instruction creation');
    console.log('');

    return allPassed;
}

// Run tests
testX402Flow()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Test failed with error:', error);
        process.exit(1);
    });
