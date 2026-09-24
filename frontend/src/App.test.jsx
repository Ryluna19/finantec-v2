import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react'
import App from './App'


afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

function createDeferredPromise() {
    let resolve
    let reject

    const promise = new Promise((promiseResolve, promiseReject) => {
        resolve = promiseResolve
        reject = promiseReject
    })

    return {
        promise,
        resolve,
        reject,
    }
}

describe('App transactions', () => {
    it('keeps a newly created transaction when the initial GET resolves later', async () => {
        const initialGet = createDeferredPromise()

        const pendingPost = createDeferredPromise()

        const today = new Date()
        const transactionDate = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            '15',
        ].join('-')

        const createdTransaction = {
            id: '11111111-1111-4111-8111-111111111111',
            date: transactionDate,
            description: 'Salário',
            category: 'Trabalho',
            type: 'income',
            amountInCents: 150000,
        }

        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                return initialGet.promise
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                options.method === 'POST'
            ) {
                return pendingPost.promise
            }

            throw new Error(`Unexpected fetch: ${options.method ?? 'GET'} ${url}`)
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        fireEvent.change(screen.getByLabelText('Data'), {
            target: { value: transactionDate },
        })

        fireEvent.change(screen.getByLabelText('Descrição'), {
            target: { value: 'Salário' },
        })

        fireEvent.change(screen.getByLabelText('Categoria'), {
            target: { value: 'Trabalho' },
        })

        fireEvent.change(screen.getByLabelText('Tipo'), {
            target: { value: 'income' },
        })

        fireEvent.change(screen.getByLabelText('Valor (R$)'), {
            target: { value: '1500,00' },
        })

        fireEvent.submit(
            screen.getByRole('button', {
                name: 'Adicionar transação',
            }).closest('form'),
        )

        await waitFor(() => {
            expect(
                screen.getByRole('button', {
                    name: 'Adicionando...',
                }).disabled,
            ).toBe(true)
        })

        pendingPost.resolve({
            ok: true,
            json: async () => createdTransaction,
        })

        await waitFor(() => {
            expect(
                screen.getByRole('button', {
                    name: 'Adicionar transação',
                }).disabled,
            ).toBe(false)
        })

        initialGet.resolve({
            ok: true,
            json: async () => [],
        })

        await waitFor(() => {
            expect(screen.getByText('Salário')).toBeTruthy()
        })
    })

    it('shows a loading error instead of an empty state when the initial GET fails', async () => {
        const initialGet = createDeferredPromise()

        const fetchMock = vi.fn(() => initialGet.promise)

        vi.stubGlobal('fetch', fetchMock)

        vi.spyOn(console, 'error').mockImplementation(() => { })

        render(<App />)

        expect(screen.getByRole('status').textContent).toContain(
            'Carregando transações...',
        )

        initialGet.reject(new Error('Backend unavailable'))

        await waitFor(() => {
            expect(screen.getByRole('alert').textContent).toContain(
                'Não foi possível carregar as transações.',
            )
        })

        expect(
            screen.queryByText(
                'Nenhuma transação encontrada para o período selecionado.',
            ),
        ).toBeNull()
    })

    it('prevents a second submission while the first POST is pending', async () => {
        const pendingPost = createDeferredPromise()

        const today = new Date()
        const transactionDate = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            '15',
        ].join('-')

        const createdTransaction = {
            id: '22222222-2222-4222-8222-222222222222',
            date: transactionDate,
            description: 'Freela',
            category: 'Trabalho',
            type: 'income',
            amountInCents: 80000,
        }

        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [],
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                options.method === 'POST'
            ) {
                return pendingPost.promise
            }

            throw new Error(`Unexpected fetch: ${options.method ?? 'GET'} ${url}`)
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        await screen.findByText(
            'Nenhuma transação encontrada para o período selecionado.',
        )

        fireEvent.change(screen.getByLabelText('Data'), {
            target: { value: transactionDate },
        })

        fireEvent.change(screen.getByLabelText('Descrição'), {
            target: { value: 'Freela' },
        })

        fireEvent.change(screen.getByLabelText('Categoria'), {
            target: { value: 'Trabalho' },
        })

        fireEvent.change(screen.getByLabelText('Tipo'), {
            target: { value: 'income' },
        })

        fireEvent.change(screen.getByLabelText('Valor (R$)'), {
            target: { value: '800,00' },
        })

        const submitButton = screen.getByRole('button', {
            name: 'Adicionar transação',
        })

        const form = submitButton.closest('form')

        fireEvent.submit(form)
        fireEvent.submit(form)

        await waitFor(() => {
            expect(submitButton.disabled).toBe(true)
            expect(screen.getByLabelText('Descrição').disabled).toBe(true)
        })

        const postCalls = fetchMock.mock.calls.filter(
            ([, options = {}]) => options.method === 'POST',
        )

        expect(postCalls).toHaveLength(1)

        pendingPost.resolve({
            ok: true,
            json: async () => createdTransaction,
        })

        await waitFor(() => {
            expect(submitButton.disabled).toBe(false)
            expect(screen.getByText('Freela')).toBeTruthy()
        })

        expect(
            fetchMock.mock.calls.filter(
                ([, options = {}]) => options.method === 'POST',
            ),
        ).toHaveLength(1)
    })
})