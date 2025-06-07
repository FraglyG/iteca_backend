import * as crypto from 'crypto'

export type KeyType = "user" | "channel" | "message" | "listing"

const prefixForKeyType: Record<KeyType, string> = {
    "user": "us",
    "channel": "ch",
    "message": "msg",
    "listing": "li"
}

const seperator = "-"

const started = 1749121992893
export function getKey(type?: KeyType) {
    let prefix = ""

    if (type) {
        prefix = prefixForKeyType[type]
    }

    const now = Date.now() - started
    const random = crypto.randomBytes(2).toString('hex')

    return `${prefix}${seperator}${now.toString(36)}${seperator}${random}`
}