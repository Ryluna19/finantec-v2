import { useState } from 'react'

function TransactionForm({ onAddTransaction }) {
    const [error, setError] = useState('')

    async function handleSubmit(event)  {
        event.preventDefault()

        const form = event.currentTarget
        const formData = new FormData(form)
        const date = formData.get('date')
        const description = formData.get('description').trim()
        const category = formData.get('category').trim()
        const type = formData.get('type')
        const amount = formData.get('amount').trim()

        if (!date) {
            setError('Preencha a data.')
            return
        }

        if (!description || !category) {
            setError('Preencha a descrição e a categoria.')
            return
        }

        if (!['income', 'expense'].includes(type)) {
            setError('Selecione um tipo válido.')
            return
        }

        if (!/^\d+([,.]\d{1,2})?$/.test(amount)) {
            setError('Informe um valor como 85,90, sem separador de milhares.')
            return
        }

        // Converte as partes para centavos sem multiplicar um número decimal.
        const [whole, fraction = ''] = amount.replace(',', '.').split('.')
        const amountInCents =
            Number(whole) * 100 + Number(fraction.padEnd(2, '0'))

        if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
            setError('Informe um valor positivo dentro do limite permitido.')
            return
        }

        try {
            await onAddTransaction({
                date,
                description,
                category,
                type,
                amountInCents,
            })

            setError('')
            form.reset()
            } catch (error) {
            setError(error.message)
        }
    }

    return (
        <form className="transaction-form" onSubmit={handleSubmit}>
            <div className="form-field">
                <label htmlFor="transaction-date">Data</label>
                <input
                    id="transaction-date"
                    name="date"
                    type="date"
                    required
                />
            </div>
            <div className="form-field">
                <label htmlFor="transaction-description">Descrição</label>
                <input
                    id="transaction-description"
                    name="description"
                    required
                />
            </div>

            <div className="form-field">
                <label htmlFor="transaction-category">Categoria</label>
                <input
                    id="transaction-category"
                    name="category"
                    required
                />
            </div>

            <div className="form-field">
                <label htmlFor="transaction-type">Tipo</label>
                <select id="transaction-type" name="type" defaultValue="expense">
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                </select>
            </div>

            <div className="form-field">
                <label htmlFor="transaction-amount">Valor (R$)</label>
                <input
                    id="transaction-amount"
                    name="amount"
                    inputMode="decimal"
                    placeholder="85,90"
                    maxLength={16}
                    aria-describedby="transaction-amount-hint"
                    required
                />
                <small id="transaction-amount-hint">
                    Sem separador de milhares. Exemplo: 1500,50.
                </small>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="submit-button" type="submit">
                Adicionar transação
            </button>
        </form>
    )
}

export default TransactionForm