package minibank.minibank.common.error;

public final class ErrorCodes {

    public static final String VALIDATION_ERROR = "VALIDATION_ERROR";
    public static final String UNAUTHORIZED = "UNAUTHORIZED";
    public static final String FORBIDDEN = "FORBIDDEN";
    public static final String NOT_FOUND = "NOT_FOUND";
    public static final String CONFLICT = "CONFLICT";
    public static final String BUSINESS_RULE_VIOLATION = "BUSINESS_RULE_VIOLATION";
    public static final String TRANSFER_SAME_ACCOUNT = "TRANSFER_SAME_ACCOUNT";
    public static final String TRANSFER_SOURCE_INACTIVE = "TRANSFER_SOURCE_INACTIVE";
    public static final String TRANSFER_INVALID_AMOUNT = "TRANSFER_INVALID_AMOUNT";
    public static final String TRANSFER_INSUFFICIENT_FUNDS = "TRANSFER_INSUFFICIENT_FUNDS";
    public static final String TRANSFER_INVALID_TARGET = "TRANSFER_INVALID_TARGET";
    public static final String DAILY_LIMIT_EXCEEDED = "DAILY_LIMIT_EXCEEDED";
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";

    private ErrorCodes() {
    }
}
