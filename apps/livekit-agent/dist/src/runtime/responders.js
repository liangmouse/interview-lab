export function createUserTextResponder(args) {
    const { session } = args;
    return async (text) => {
        const trimmed = text.trim();
        if (!trimmed)
            return;
        await session.generateReply({
            userInput: trimmed,
            allowInterruptions: false,
        });
    };
}
