package minibank.minibank.common.error;

public record FieldErrorResponse(
        String field,
        String message
) {
}
