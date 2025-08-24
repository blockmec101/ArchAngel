import { createMocks } from "node-mocks-http"
import handler from "../../pages/api/sign-transaction"

describe("/api/sign-transaction", () => {
  test("returns 405 for non-POST requests", async () => {
    const { req, res } = createMocks({
      method: "GET",
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(405)
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        error: "Method not allowed",
      }),
    )
  })

  test("returns 400 for missing serializedTransaction", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: {},
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(400)
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        error: "Missing serializedTransaction",
      }),
    )
  })
})

