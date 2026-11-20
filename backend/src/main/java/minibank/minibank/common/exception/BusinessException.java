package minibank.minibank.common.exception;

import minibank.minibank.common.error.ErrorCodes;
import org.springframework.http.HttpStatus;

public class BusinessException extends RuntimeException {

    private final String code;
    private final HttpStatus status;

    public BusinessException(String message) {
        this(ErrorCodes.BUSINESS_RULE_VIOLATION, message, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    public BusinessException(String code, String message, HttpStatus status) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public String getCode() {
        return code;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
