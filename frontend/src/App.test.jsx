import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
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
})

