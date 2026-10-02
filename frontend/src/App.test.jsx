import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react'
import App from './App'

const AUTHENTICATED_USER = {
    id: '6b959525-67fc-453c-b4b2-956058724f22',
    username: 'Ryan',
}

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

async function resolveDeferredPromise(deferred, value) {
    await act(async () => {
        deferred.resolve(value)

        // Espera o consumidor da promise retomar e permite que os
        // awaits imediatamente seguintes também sejam processados.
        await deferred.promise
        await Promise.resolve()
    })
}
async function rejectDeferredPromise(deferred, error) {
    await act(async () => {
        deferred.reject(error)

        /*
         * Consome a rejeição também pelo lado do teste enquanto permite
         * que o código da aplicação execute seu próprio catch.
         */
        await deferred.promise.catch(() => { })
        await Promise.resolve()
    })
}

function createAuthenticatedSessionResponse() {
    return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
            user: AUTHENTICATED_USER,
        }),
    })
}

describe('App transactions', () => {

    it('does not load transactions when there is no authenticated session', async () => {
        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: false,
                    status: 401,
                    json: async () => ({
                        error: 'Sessão inválida ou expirada.',
                    }),
                })
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        expect(screen.getByRole('status').textContent).toContain(
            'Verificando sessão...',
        )

        await screen.findByRole('heading', {
            name: 'Entrar',
        })

        expect(fetchMock).toHaveBeenCalledTimes(1)

        expect(fetchMock).toHaveBeenCalledWith(
            'http://localhost:3000/auth/me',
            {
                credentials: 'include',
            },
        )

        expect(
            fetchMock.mock.calls.some(
                ([url]) =>
                    url === 'http://localhost:3000/transactions',
            ),
        ).toBe(false)
    })

    it('logs in and loads transactions for the authenticated user', async () => {
        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: false,
                    status: 401,
                    json: async () => ({
                        error: 'Sessão inválida ou expirada.',
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/auth/login' &&
                options.method === 'POST'
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: AUTHENTICATED_USER,
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [],
                })
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        await screen.findByRole('heading', {
            name: 'Entrar',
        })

        fireEvent.change(
            screen.getByLabelText('Nome de usuário'),
            {
                target: { value: 'Ryan' },
            },
        )

        fireEvent.change(screen.getByLabelText('Senha'), {
            target: { value: 'senha123' },
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Entrar',
            }),
        )

        await screen.findByText(
            'Nenhuma transação encontrada para o período selecionado.',
        )

        const loginCall = fetchMock.mock.calls.find(
            ([url]) =>
                url === 'http://localhost:3000/auth/login',
        )

        expect(loginCall).toBeTruthy()

        expect(loginCall[1]).toEqual({
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: 'Ryan',
                password: 'senha123',
            }),
        })

        expect(
            fetchMock.mock.calls.some(
                ([url]) =>
                    url === 'http://localhost:3000/transactions',
            ),
        ).toBe(true)
    })

    it('registers a new user and loads their transactions', async () => {
        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: false,
                    status: 401,
                    json: async () => ({
                        error: 'Sessão inválida ou expirada.',
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/auth/register' &&
                options.method === 'POST'
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 201,
                    json: async () => ({
                        user: AUTHENTICATED_USER,
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [],
                })
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        await screen.findByRole('heading', {
            name: 'Entrar',
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Criar uma conta',
            }),
        )

        expect(
            screen.getByRole('heading', {
                name: 'Criar conta',
            }),
        ).toBeTruthy()

        fireEvent.change(
            screen.getByLabelText('Nome de usuário'),
            {
                target: { value: 'Ryan' },
            },
        )

        fireEvent.change(screen.getByLabelText('Senha'), {
            target: { value: 'senha123' },
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Criar conta',
            }),
        )

        await screen.findByText(
            'Nenhuma transação encontrada para o período selecionado.',
        )

        const registerCall = fetchMock.mock.calls.find(
            ([url]) =>
                url === 'http://localhost:3000/auth/register',
        )

        expect(registerCall).toBeTruthy()

        expect(registerCall[1]).toEqual({
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: 'Ryan',
                password: 'senha123',
            }),
        })

        expect(
            fetchMock.mock.calls.some(
                ([url]) =>
                    url === 'http://localhost:3000/transactions',
            ),
        ).toBe(true)
    })

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
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return createAuthenticatedSessionResponse()
            }

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

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        const dateInput = await screen.findByLabelText('Data')

        fireEvent.change(dateInput, {
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

        await resolveDeferredPromise(initialGet, {
            ok: true,
            json: async () => [],
        })

        expect(screen.getByText('Salário')).toBeTruthy()
    })

    it('shows a loading error instead of an empty state when the initial GET fails', async () => {
        const initialGet = createDeferredPromise()

        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return createAuthenticatedSessionResponse()
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                return initialGet.promise
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        vi.spyOn(console, 'error').mockImplementation(() => { })

        render(<App />)

        await screen.findByText('Carregando transações...')

        await rejectDeferredPromise(
            initialGet,
            new Error('Backend unavailable'),
        )

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
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return createAuthenticatedSessionResponse()
            }

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

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
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

    it('ignores an old transactions GET after the authenticated user changes', async () => {
        const oldTransactionsGet = createDeferredPromise()

        const userB = {
            id: '77777777-7777-4777-8777-777777777777',
            username: 'Maria',
        }

        const today = new Date()
        const transactionDate = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            '15',
        ].join('-')

        const transactionFromA = {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            date: transactionDate,
            description: 'Transação da conta A',
            category: 'Teste',
            type: 'income',
            amountInCents: 10000,
        }

        const transactionFromB = {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            date: transactionDate,
            description: 'Transação da conta B',
            category: 'Teste',
            type: 'income',
            amountInCents: 20000,
        }

        let transactionsGetCount = 0

        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: AUTHENTICATED_USER,
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                transactionsGetCount += 1

                if (transactionsGetCount === 1) {
                    return oldTransactionsGet.promise
                }

                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => [transactionFromB],
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                options.method === 'POST'
            ) {
                return Promise.resolve({
                    ok: false,
                    status: 401,
                    json: async () => ({
                        error: 'Sessão inválida ou expirada.',
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/auth/login' &&
                options.method === 'POST'
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: userB,
                    }),
                })
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        const dateInput = await screen.findByLabelText('Data')

        fireEvent.change(dateInput, {
            target: { value: transactionDate },
        })

        fireEvent.change(screen.getByLabelText('Descrição'), {
            target: { value: 'Forçar expiração' },
        })

        fireEvent.change(screen.getByLabelText('Categoria'), {
            target: { value: 'Teste' },
        })

        fireEvent.change(screen.getByLabelText('Tipo'), {
            target: { value: 'income' },
        })

        fireEvent.change(screen.getByLabelText('Valor (R$)'), {
            target: { value: '10,00' },
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Adicionar transação',
            }),
        )

        await screen.findByRole('heading', {
            name: 'Entrar',
        })

        fireEvent.change(
            screen.getByLabelText('Nome de usuário'),
            {
                target: { value: 'Maria' },
            },
        )

        fireEvent.change(screen.getByLabelText('Senha'), {
            target: { value: 'senha123' },
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Entrar',
            }),
        )

        await screen.findByText('Transação da conta B')

        await resolveDeferredPromise(oldTransactionsGet, {
            ok: true,
            status: 200,
            json: async () => [transactionFromA],
        })

        expect(
            screen.getByText('Transação da conta B'),
        ).toBeTruthy()

        expect(
            screen.queryByText('Transação da conta A'),
        ).toBeNull()

        expect(transactionsGetCount).toBe(2)
    })

    it('ignores an old transaction POST after the authenticated user changes', async () => {
        const oldTransactionsGet = createDeferredPromise()
        const oldPost = createDeferredPromise()

        const userB = {
            id: '88888888-8888-4888-8888-888888888888',
            username: 'Maria',
        }

        const today = new Date()
        const transactionDate = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            '15',
        ].join('-')

        const transactionFromA = {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            date: transactionDate,
            description: 'POST antigo da conta A',
            category: 'Teste',
            type: 'income',
            amountInCents: 30000,
        }

        const transactionFromB = {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            date: transactionDate,
            description: 'Dados da conta B',
            category: 'Teste',
            type: 'income',
            amountInCents: 40000,
        }

        let transactionsGetCount = 0

        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: AUTHENTICATED_USER,
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                transactionsGetCount += 1

                if (transactionsGetCount === 1) {
                    return oldTransactionsGet.promise
                }

                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => [transactionFromB],
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                options.method === 'POST'
            ) {
                return oldPost.promise
            }

            if (
                url === 'http://localhost:3000/auth/login' &&
                options.method === 'POST'
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: userB,
                    }),
                })
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        const dateInput = await screen.findByLabelText('Data')

        fireEvent.change(dateInput, {
            target: { value: transactionDate },
        })

        fireEvent.change(screen.getByLabelText('Descrição'), {
            target: { value: 'POST antigo da conta A' },
        })

        fireEvent.change(screen.getByLabelText('Categoria'), {
            target: { value: 'Teste' },
        })

        fireEvent.change(screen.getByLabelText('Tipo'), {
            target: { value: 'income' },
        })

        fireEvent.change(screen.getByLabelText('Valor (R$)'), {
            target: { value: '300,00' },
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Adicionar transação',
            }),
        )

        await screen.findByRole('button', {
            name: 'Adicionando...',
        })

        oldTransactionsGet.resolve({
            ok: false,
            status: 401,
            json: async () => ({
                error: 'Sessão inválida ou expirada.',
            }),
        })

        await screen.findByRole('heading', {
            name: 'Entrar',
        })

        fireEvent.change(
            screen.getByLabelText('Nome de usuário'),
            {
                target: { value: 'Maria' },
            },
        )

        fireEvent.change(screen.getByLabelText('Senha'), {
            target: { value: 'senha123' },
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Entrar',
            }),
        )

        await screen.findByText('Dados da conta B')

        await resolveDeferredPromise(oldPost, {
            ok: true,
            status: 201,
            json: async () => transactionFromA,
        })

        expect(
            screen.getByText('Dados da conta B'),
        ).toBeTruthy()

        expect(
            screen.queryByText('POST antigo da conta A'),
        ).toBeNull()

        expect(transactionsGetCount).toBe(2)
    })

    it('ignores a late 401 from the previous authenticated user', async () => {
        const oldTransactionsGet = createDeferredPromise()
        const oldPost = createDeferredPromise()

        const userB = {
            id: '99999999-9999-4999-8999-999999999999',
            username: 'Maria',
        }

        const today = new Date()
        const transactionDate = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            '15',
        ].join('-')

        const transactionFromB = {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            date: transactionDate,
            description: 'Conta B continua autenticada',
            category: 'Teste',
            type: 'income',
            amountInCents: 50000,
        }

        let transactionsGetCount = 0

        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: AUTHENTICATED_USER,
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                transactionsGetCount += 1

                if (transactionsGetCount === 1) {
                    return oldTransactionsGet.promise
                }

                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => [transactionFromB],
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                options.method === 'POST'
            ) {
                return oldPost.promise
            }

            if (
                url === 'http://localhost:3000/auth/login' &&
                options.method === 'POST'
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: userB,
                    }),
                })
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        const dateInput = await screen.findByLabelText('Data')

        fireEvent.change(dateInput, {
            target: { value: transactionDate },
        })

        fireEvent.change(screen.getByLabelText('Descrição'), {
            target: { value: 'Operação da conta A' },
        })

        fireEvent.change(screen.getByLabelText('Categoria'), {
            target: { value: 'Teste' },
        })

        fireEvent.change(screen.getByLabelText('Tipo'), {
            target: { value: 'income' },
        })

        fireEvent.change(screen.getByLabelText('Valor (R$)'), {
            target: { value: '100,00' },
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Adicionar transação',
            }),
        )

        await screen.findByRole('button', {
            name: 'Adicionando...',
        })

        // Outra requisição da conta A detecta a sessão expirada.
        await resolveDeferredPromise(oldTransactionsGet, {
            ok: false,
            status: 401,
            json: async () => ({
                error: 'Sessão inválida ou expirada.',
            }),
        })

        await screen.findByRole('heading', {
            name: 'Entrar',
        })

        fireEvent.change(
            screen.getByLabelText('Nome de usuário'),
            {
                target: { value: 'Maria' },
            },
        )

        fireEvent.change(screen.getByLabelText('Senha'), {
            target: { value: 'senha123' },
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Entrar',
            }),
        )

        await screen.findByText(
            'Conta B continua autenticada',
        )

        // O POST de A termina depois que B já possui uma sessão válida.
        await resolveDeferredPromise(oldPost, {
            ok: false,
            status: 401,
            json: async () => ({
                error: 'Sessão inválida ou expirada.',
            }),
        })

        expect(
            screen.getByText('Conta B continua autenticada'),
        ).toBeTruthy()

        expect(
            screen.queryByRole('heading', {
                name: 'Entrar',
            }),
        ).toBeNull()

        expect(transactionsGetCount).toBe(2)
    })
    it('logs out and ignores private data from a request started before logout', async () => {
        const oldTransactionsGet = createDeferredPromise()
        const logoutRequest = createDeferredPromise()

        const today = new Date()
        const transactionDate = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            '15',
        ].join('-')

        const oldTransaction = {
            id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            date: transactionDate,
            description: 'Dado antigo da conta',
            category: 'Teste',
            type: 'income',
            amountInCents: 60000,
        }

        let transactionsGetCount = 0

        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: AUTHENTICATED_USER,
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                transactionsGetCount += 1
                return oldTransactionsGet.promise
            }

            if (
                url === 'http://localhost:3000/auth/logout' &&
                options.method === 'POST'
            ) {
                return logoutRequest.promise
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        const logoutButton = await screen.findByRole('button', {
            name: 'Sair',
        })

        fireEvent.click(logoutButton)

        await screen.findByText('Encerrando sessão...')

        expect(
            screen.queryByRole('button', {
                name: 'Sair',
            }),
        ).toBeNull()

        await resolveDeferredPromise(logoutRequest, {
            ok: true,
            status: 204,
        })

        await screen.findByRole('heading', {
            name: 'Entrar',
        })

        await resolveDeferredPromise(oldTransactionsGet, {
            ok: true,
            status: 200,
            json: async () => [oldTransaction],
        })

        expect(
            screen.getByRole('heading', {
                name: 'Entrar',
            }),
        ).toBeTruthy()

        expect(
            screen.queryByText('Dado antigo da conta'),
        ).toBeNull()

        expect(transactionsGetCount).toBe(1)

        const logoutCall = fetchMock.mock.calls.find(
            ([url]) =>
                url === 'http://localhost:3000/auth/logout',
        )

        expect(logoutCall).toBeTruthy()

        expect(logoutCall[1]).toEqual({
            method: 'POST',
            credentials: 'include',
        })
    })
    it('restores the authenticated user when logout fails but the session is still valid', async () => {
        const logoutRequest = createDeferredPromise()

        const today = new Date()
        const transactionDate = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            '15',
        ].join('-')

        const transaction = {
            id: '12121212-1212-4212-8212-121212121212',
            date: transactionDate,
            description: 'Sessão restaurada',
            category: 'Teste',
            type: 'income',
            amountInCents: 70000,
        }

        let authMeCount = 0
        let transactionsGetCount = 0

        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                authMeCount += 1

                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: AUTHENTICATED_USER,
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                transactionsGetCount += 1

                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => [transaction],
                })
            }

            if (
                url === 'http://localhost:3000/auth/logout' &&
                options.method === 'POST'
            ) {
                return logoutRequest.promise
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        await screen.findByText('Sessão restaurada')

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Sair',
            }),
        )

        await screen.findByText('Encerrando sessão...')

        await resolveDeferredPromise(logoutRequest, {
            ok: false,
            status: 500,
        })

        await screen.findByText('Sessão restaurada')

        expect(
            screen.getByRole('button', {
                name: 'Sair',
            }),
        ).toBeTruthy()

        expect(
            screen.queryByRole('heading', {
                name: 'Entrar',
            }),
        ).toBeNull()

        expect(authMeCount).toBe(2)
        expect(transactionsGetCount).toBe(2)
    })

    it('reconciles the selected period after updating its last transaction to another year', async () => {
        const today = new Date()
        const currentYear = today.getFullYear()
        const previousYear = currentYear - 1
        const currentMonth = today.getMonth() + 1
        const currentMonthText = String(currentMonth).padStart(2, '0')

        const previousYearTransaction = {
            id: '31313131-3131-4313-8313-313131313131',
            date: `${previousYear}-01-15`,
            description: 'Transação do ano anterior',
            category: 'Trabalho',
            type: 'income',
            amountInCents: 10000,
        }

        const currentTransaction = {
            id: '32323232-3232-4323-8323-323232323232',
            date: `${currentYear}-${currentMonthText}-10`,
            description: 'Transação atual',
            category: 'Trabalho',
            type: 'income',
            amountInCents: 20000,
        }

        const movedTransaction = {
            ...previousYearTransaction,
            date: `${currentYear}-${currentMonthText}-20`,
            description: 'Transação movida',
        }

        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: AUTHENTICATED_USER,
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => [
                        currentTransaction,
                        previousYearTransaction,
                    ],
                })
            }

            if (
                url ===
                `http://localhost:3000/transactions/${previousYearTransaction.id}` &&
                options.method === 'PUT'
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => movedTransaction,
                })
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        await screen.findByText('Transação atual')

        fireEvent.change(screen.getByLabelText('Ano'), {
            target: {
                value: String(previousYear),
            },
        })

        await screen.findByText('Transação do ano anterior')

        expect(screen.getByLabelText('Mês').value).toBe('all')

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Editar Transação do ano anterior',
            }),
        )

        expect(
            screen.getByRole('heading', {
                name: 'Editar transação',
            }),
        ).toBeTruthy()

        fireEvent.change(screen.getByLabelText('Data'), {
            target: {
                value: movedTransaction.date,
            },
        })

        fireEvent.change(screen.getByLabelText('Descrição'), {
            target: {
                value: movedTransaction.description,
            },
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Salvar alterações',
            }),
        )

        await screen.findByText('Transação movida')

        expect(screen.getByLabelText('Ano').value).toBe(
            String(currentYear),
        )

        expect(screen.getByLabelText('Mês').value).toBe(
            String(currentMonth),
        )

        expect(
            screen.getByRole('heading', {
                name: 'Nova transação',
            }),
        ).toBeTruthy()

        const transactionList = screen.getByRole('region', {
            name: 'Lista de transações',
        })

        const rows = within(transactionList).getAllByRole('row')

        expect(
            within(rows[1]).getByText('Transação movida'),
        ).toBeTruthy()

        expect(
            within(rows[2]).getByText('Transação atual'),
        ).toBeTruthy()

        const summary = screen.getByLabelText(
            'Resumo das transações filtradas',
        )

        expect(within(summary).getByText('2')).toBeTruthy()
    })
    it('reconciles the latest filters and closes editing after deleting the edited transaction', async () => {
        const pendingDelete = createDeferredPromise()

        const today = new Date()
        const transactionDate = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            '15',
        ].join('-')

        const editedTransaction = {
            id: '41414141-4141-4414-8414-414141414141',
            date: transactionDate,
            description: 'Mercado',
            category: 'Casa',
            type: 'expense',
            amountInCents: 15000,
        }

        const remainingTransaction = {
            id: '42424242-4242-4424-8424-424242424242',
            date: transactionDate,
            description: 'Freela',
            category: 'Trabalho',
            type: 'income',
            amountInCents: 50000,
        }

        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: AUTHENTICATED_USER,
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => [
                        editedTransaction,
                        remainingTransaction,
                    ],
                })
            }

            if (
                url ===
                `http://localhost:3000/transactions/${editedTransaction.id}` &&
                options.method === 'DELETE'
            ) {
                return pendingDelete.promise
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        vi.spyOn(window, 'confirm').mockReturnValue(true)

        render(<App />)

        await screen.findByText('Mercado')

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Editar Mercado',
            }),
        )

        expect(
            screen.getByRole('heading', {
                name: 'Editar transação',
            }),
        ).toBeTruthy()

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Excluir Mercado',
            }),
        )

        const filters = screen.getByLabelText(
            'Filtros de transações',
        )

        const categoryFilter = within(filters).getByLabelText(
            'Categoria',
        )

        /*
         * A seleção muda enquanto o DELETE ainda está pendente.
         * A reconciliação precisa usar esta seleção atual,
         * e não a seleção existente quando a requisição começou.
         */
        fireEvent.change(categoryFilter, {
            target: {
                value: 'Casa',
            },
        })

        expect(categoryFilter.value).toBe('Casa')

        await resolveDeferredPromise(pendingDelete, {
            ok: true,
            status: 204,
        })

        expect(
            screen.getByRole('heading', {
                name: 'Nova transação',
            }),
        ).toBeTruthy()

        expect(
            screen.queryByText('Mercado'),
        ).toBeNull()

        /*
         * "Casa" deixou de existir após a exclusão.
         * Como esse era o filtro ATUAL, ele precisa voltar para "all".
         */
        expect(categoryFilter.value).toBe('all')

        expect(screen.getByText('Freela')).toBeTruthy()
    })

    it('ignores a pending DELETE from the previous user after another user signs in', async () => {
        const pendingDelete = createDeferredPromise()

        const userB = {
            id: '81818181-8181-4818-8818-818181818181',
            username: 'Maria',
        }

        const today = new Date()

        const transactionDate = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            '15',
        ].join('-')

        const transactionFromA = {
            id: '82828282-8282-4828-8828-828282828282',
            date: transactionDate,
            description: 'Excluir da conta A',
            category: 'Teste',
            type: 'expense',
            amountInCents: 10000,
        }

        const transactionFromB = {
            id: '83838383-8383-4838-8838-838383838383',
            date: transactionDate,
            description: 'Transação preservada da conta B',
            category: 'Trabalho',
            type: 'income',
            amountInCents: 50000,
        }

        let transactionsGetCount = 0

        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: AUTHENTICATED_USER,
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                transactionsGetCount += 1

                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () =>
                        transactionsGetCount === 1
                            ? [transactionFromA]
                            : [transactionFromB],
                })
            }

            if (
                url ===
                `http://localhost:3000/transactions/${transactionFromA.id}` &&
                options.method === 'DELETE'
            ) {
                return pendingDelete.promise
            }

            if (
                url === 'http://localhost:3000/auth/logout' &&
                options.method === 'POST'
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 204,
                })
            }

            if (
                url === 'http://localhost:3000/auth/login' &&
                options.method === 'POST'
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: userB,
                    }),
                })
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        vi.spyOn(window, 'confirm').mockReturnValue(true)

        const alertSpy = vi
            .spyOn(window, 'alert')
            .mockImplementation(() => { })

        render(<App />)

        await screen.findByText('Excluir da conta A')

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Excluir Excluir da conta A',
            }),
        )

        expect(
            fetchMock.mock.calls.some(
                ([url, options = {}]) =>
                    url ===
                    `http://localhost:3000/transactions/${transactionFromA.id}` &&
                    options.method === 'DELETE',
            ),
        ).toBe(true)

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Sair',
            }),
        )

        await screen.findByRole('heading', {
            name: 'Entrar',
        })

        fireEvent.change(
            screen.getByLabelText('Nome de usuário'),
            {
                target: {
                    value: 'Maria',
                },
            },
        )

        fireEvent.change(screen.getByLabelText('Senha'), {
            target: {
                value: 'senha123',
            },
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Entrar',
            }),
        )

        await screen.findByText(
            'Transação preservada da conta B',
        )

        await resolveDeferredPromise(pendingDelete, {
            ok: true,
            status: 204,
        })

        expect(
            screen.getByText(
                'Transação preservada da conta B',
            ),
        ).toBeTruthy()

        expect(
            screen.queryByText('Excluir da conta A'),
        ).toBeNull()

        expect(
            screen.queryByRole('heading', {
                name: 'Entrar',
            }),
        ).toBeNull()

        expect(alertSpy).not.toHaveBeenCalled()
        expect(transactionsGetCount).toBe(2)
    })

    it('shows the financial overview without loading transactions again', async () => {
        const today = new Date()
        const currentYear = today.getFullYear()
        const currentMonth = today.getMonth() + 1

        const currentMonthText = String(
            currentMonth,
        ).padStart(2, '0')

        const transactions = [
            {
                id: '91919191-9191-4919-8919-919191919191',
                date: `${currentYear}-${currentMonthText}-05`,
                description: 'Salário',
                category: 'Trabalho',
                type: 'income',
                amountInCents: 80000,
            },
            {
                id: '92929292-9292-4929-8929-929292929292',
                date: `${currentYear}-${currentMonthText}-10`,
                description: 'Mercado',
                category: 'Casa',
                type: 'expense',
                amountInCents: 5500,
            },
            {
                id: '93939393-9393-4939-8939-939393939393',
                date: `${currentYear}-${currentMonthText}-15`,
                description: 'Reserva mensal',
                category: 'Reserva',
                type: 'expense',
                amountInCents: 10000,
            },
            {
                id: '94949494-9494-4949-8949-949494949494',
                date: `${currentYear - 1}-06-15`,
                description: 'Transação fora do período',
                category: 'Teste',
                type: 'income',
                amountInCents: 900000,
            },
        ]

        let transactionsGetCount = 0

        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: AUTHENTICATED_USER,
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                transactionsGetCount += 1

                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => transactions,
                })
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        await screen.findByText('Salário')

        expect(transactionsGetCount).toBe(1)

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Visão geral',
            }),
        )

        await screen.findByRole('heading', {
            name: 'Visão geral',
        })

        const summary = screen.getByLabelText(
            'Resumo financeiro do período',
        )

        expect(
            within(summary).getByText('R$ 64,50'),
        ).toBeTruthy()

        expect(
            within(summary).getByText('R$ 800,00'),
        ).toBeTruthy()

        expect(
            within(summary).getByText('R$ 55,00'),
        ).toBeTruthy()

        expect(
            within(summary).getByText('R$ 100,00'),
        ).toBeTruthy()

        expect(
            screen.queryByText(
                'Transação fora do período',
            ),
        ).toBeNull()

        expect(transactionsGetCount).toBe(1)

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Transações',
            }),
        )

        await screen.findByText('Salário')

        expect(transactionsGetCount).toBe(1)
    })

    it('clears private filters and editing when another user signs in', async () => {
        const userB = {
            id: '51515151-5151-4515-8515-515151515151',
            username: 'Maria',
        }

        const today = new Date()
        const currentYear = today.getFullYear()
        const currentMonth = today.getMonth() + 1
        const previousYear = currentYear - 1

        const currentMonthText = String(currentMonth).padStart(
            2,
            '0',
        )

        const transactionFromA = {
            id: '61616161-6161-4616-8616-616161616161',
            date: `${previousYear}-06-15`,
            description: 'Despesa antiga da conta A',
            category: 'Casa',
            type: 'expense',
            amountInCents: 15000,
        }

        const transactionFromB = {
            id: '71717171-7171-4717-8717-717171717171',
            date: `${currentYear}-${currentMonthText}-15`,
            description: 'Receita da conta B',
            category: 'Trabalho',
            type: 'income',
            amountInCents: 50000,
        }

        let transactionsGetCount = 0

        const fetchMock = vi.fn((url, options = {}) => {
            if (
                url === 'http://localhost:3000/auth/me' &&
                !options.method
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: AUTHENTICATED_USER,
                    }),
                })
            }

            if (
                url === 'http://localhost:3000/transactions' &&
                !options.method
            ) {
                transactionsGetCount += 1

                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () =>
                        transactionsGetCount === 1
                            ? [transactionFromA]
                            : [transactionFromB],
                })
            }

            if (
                url === 'http://localhost:3000/auth/logout' &&
                options.method === 'POST'
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 204,
                })
            }

            if (
                url === 'http://localhost:3000/auth/login' &&
                options.method === 'POST'
            ) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: userB,
                    }),
                })
            }

            throw new Error(
                `Unexpected fetch: ${options.method ?? 'GET'} ${url}`,
            )
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<App />)

        const yearFilter = await screen.findByLabelText('Ano')

        fireEvent.change(yearFilter, {
            target: {
                value: String(previousYear),
            },
        })

        await screen.findByText('Despesa antiga da conta A')

        const filtersFromA = screen.getByLabelText(
            'Filtros de transações',
        )

        expect(
            within(filtersFromA).getByLabelText('Mês').value,
        ).toBe('all')

        fireEvent.change(
            within(filtersFromA).getByLabelText('Tipo'),
            {
                target: {
                    value: 'expense',
                },
            },
        )

        fireEvent.change(
            within(filtersFromA).getByLabelText('Categoria'),
            {
                target: {
                    value: 'Casa',
                },
            },
        )

        fireEvent.change(
            within(filtersFromA).getByLabelText(
                'Buscar por descrição',
            ),
            {
                target: {
                    value: 'antiga',
                },
            },
        )

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Editar Despesa antiga da conta A',
            }),
        )

        expect(
            screen.getByRole('heading', {
                name: 'Editar transação',
            }),
        ).toBeTruthy()

        expect(screen.getByLabelText('Descrição').value).toBe(
            'Despesa antiga da conta A',
        )

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Sair',
            }),
        )

        await screen.findByRole('heading', {
            name: 'Entrar',
        })

        fireEvent.change(
            screen.getByLabelText('Nome de usuário'),
            {
                target: {
                    value: 'Maria',
                },
            },
        )

        fireEvent.change(screen.getByLabelText('Senha'), {
            target: {
                value: 'senha123',
            },
        })

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Entrar',
            }),
        )

        await screen.findByText('Receita da conta B')

        const filtersFromB = screen.getByLabelText(
            'Filtros de transações',
        )

        expect(
            within(filtersFromB).getByLabelText('Ano').value,
        ).toBe(String(currentYear))

        expect(
            within(filtersFromB).getByLabelText('Mês').value,
        ).toBe(String(currentMonth))

        expect(
            within(filtersFromB).getByLabelText('Tipo').value,
        ).toBe('all')

        expect(
            within(filtersFromB).getByLabelText('Categoria').value,
        ).toBe('all')

        expect(
            within(filtersFromB).getByLabelText(
                'Buscar por descrição',
            ).value,
        ).toBe('')

        expect(
            screen.getByRole('heading', {
                name: 'Nova transação',
            }),
        ).toBeTruthy()

        expect(screen.getByLabelText('Descrição').value).toBe('')
        expect(screen.getByLabelText('Data').value).toBe('')

        expect(
            screen.queryByText('Despesa antiga da conta A'),
        ).toBeNull()

        expect(transactionsGetCount).toBe(2)
    })
})

