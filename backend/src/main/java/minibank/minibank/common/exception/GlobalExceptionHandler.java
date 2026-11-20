package minibank.minibank.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import minibank.minibank.common.error.ApiErrorResponse;
import minibank.minibank.common.error.ErrorCodes;
import minibank.minibank.common.error.FieldErrorResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Comparator;
import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiErrorResponse> handleMethodArgumentNotValid(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        List<FieldErrorResponse> fieldErrors = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(fieldError -> new FieldErrorResponse(fieldError.getField(), fieldError.getDefaultMessage()))
                .sorted(Comparator.comparing(FieldErrorResponse::field))
                .toList();

        return buildResponse(
                HttpStatus.BAD_REQUEST,
                ErrorCodes.VALIDATION_ERROR,
                "Request validation failed",
                request.getRequestURI(),
                fieldErrors
        );
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ApiErrorResponse> handleConstraintViolation(
            ConstraintViolationException exception,
            HttpServletRequest request
    ) {
        List<FieldErrorResponse> fieldErrors = exception.getConstraintViolations()
                .stream()
                .map(violation -> new FieldErrorResponse(
                        violation.getPropertyPath().toString(),
                        violation.getMessage()
                ))
                .sorted(Comparator.comparing(FieldErrorResponse::field))
                .toList();

        return buildResponse(
                HttpStatus.BAD_REQUEST,
                ErrorCodes.VALIDATION_ERROR,
                "Request validation failed",
                request.getRequestURI(),
                fieldErrors
        );
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiErrorResponse> handleHttpMessageNotReadable(
            HttpMessageNotReadableException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.BAD_REQUEST,
                ErrorCodes.VALIDATION_ERROR,
                "Request body is invalid",
                request.getRequestURI()
        );
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiErrorResponse> handleMethodArgumentTypeMismatch(
            MethodArgumentTypeMismatchException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.BAD_REQUEST,
                ErrorCodes.VALIDATION_ERROR,
                "Request parameter is invalid",
                request.getRequestURI()
        );
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiErrorResponse> handleHttpRequestMethodNotSupported(
            HttpRequestMethodNotSupportedException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.METHOD_NOT_ALLOWED,
                ErrorCodes.VALIDATION_ERROR,
                "Request method is not supported",
                request.getRequestURI()
        );
    }

    @ExceptionHandler(BusinessException.class)
    ResponseEntity<ApiErrorResponse> handleBusinessException(
            BusinessException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                exception.getStatus(),
                exception.getCode(),
                exception.getMessage(),
                request.getRequestURI()
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiErrorResponse> handleAccessDenied(
            AccessDeniedException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.FORBIDDEN,
                ErrorCodes.FORBIDDEN,
                "Access denied",
                request.getRequestURI()
        );
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiErrorResponse> handleDataIntegrityViolation(
            DataIntegrityViolationException exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.CONFLICT,
                ErrorCodes.CONFLICT,
                "Resource conflict",
                request.getRequestURI()
        );
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiErrorResponse> handleUnexpectedException(
            Exception exception,
            HttpServletRequest request
    ) {
        return buildResponse(
                HttpStatus.INTERNAL_SERVER_ERROR,
                ErrorCodes.INTERNAL_ERROR,
                "Unexpected internal error",
                request.getRequestURI()
        );
    }

    private ResponseEntity<ApiErrorResponse> buildResponse(
            HttpStatus status,
            String code,
            String message,
            String path
    ) {
        return ResponseEntity
                .status(status)
                .body(ApiErrorResponse.of(status.value(), code, message, path));
    }

    private ResponseEntity<ApiErrorResponse> buildResponse(
            HttpStatus status,
            String code,
            String message,
            String path,
            List<FieldErrorResponse> fieldErrors
    ) {
        return ResponseEntity
                .status(status)
                .body(ApiErrorResponse.of(status.value(), code, message, path, fieldErrors));
    }
}
