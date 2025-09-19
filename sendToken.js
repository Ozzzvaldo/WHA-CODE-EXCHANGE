// Archivo: sendToken.js

const { ethers } = require('ethers');

// 1. Conectarse a la red
const provider = new ethers.JsonRpcProvider(process.env.BSC_URL);

// 2. Conectarse a la billetera del servidor
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// 3. Obtener el ABI del contrato
const abi = [
    "function transfer(address to, uint256 amount) returns (bool)"
];

// 4. Conectar el script con el contrato del token
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, wallet);

// 5. Función para enviar 1 token
async function sendWaterHaToken(recipientAddress) {
    try {
        const AMOUNT_TO_SEND = "1";
        const amount = ethers.parseUnits(AMOUNT_TO_SEND, 18);

        // Enviar la transacción
        const tx = await contract.transfer(recipientAddress, amount);

        console.log(`Transacción enviada: ${tx.hash}`);

        // Esperar a que la transacción sea confirmada
        await tx.wait();
        console.log("Transacción confirmada!");
        return true;
    } catch (error) {
        console.error("Error al enviar el token:", error);
        return false;
    }
}

// 6. Exportar la función para que el servidor la use
module.exports = {
    sendWaterHaToken
};