package minibank.minibank.common.exception;

import minibank.minibank.common.error.ErrorCodes;
import org.springframework.http.HttpStatus;

public class ConflictException extends BusinessException {

    public ConflictException(String message) {
        super(ErrorCodes.CONFLICT, message, HttpStatus.CONFLICT);
    }
}
